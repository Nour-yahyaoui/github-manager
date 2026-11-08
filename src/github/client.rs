use crate::error::ApiError;
use crate::github::models::*;
use crate::state::AppState;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use reqwest::{Method, Response};
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};

pub struct GitHubClient<'a> {
    state: &'a AppState,
    token: String,
}

impl<'a> GitHubClient<'a> {
    pub fn new(state: &'a AppState, token: String) -> Self {
        Self { state, token }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.state.config.github_api_base, path)
    }

    fn enc(seg: &str) -> String {
        urlencoding::encode(seg).into_owned()
    }

    fn enc_path(path: &str) -> String {
        path.split('/')
            .filter(|s| !s.is_empty())
            .map(|s| urlencoding::encode(s).into_owned())
            .collect::<Vec<_>>()
            .join("/")
    }

    async fn capture_headers(&self, resp: &Response) -> Option<RateLimitSnapshot> {
        let headers = resp.headers();

        let header_u32 = |name: &str| -> Option<u32> {
            headers
                .get(name)
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u32>().ok())
        };
        let header_i64 = |name: &str| -> Option<i64> {
            headers
                .get(name)
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<i64>().ok())
        };

        let scopes = headers
            .get("x-oauth-scopes")
            .and_then(|v| v.to_str().ok())
            .map(|raw| {
                raw.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        if let (Some(limit), Some(remaining)) = (
            header_u32("x-ratelimit-limit"),
            header_u32("x-ratelimit-remaining"),
        ) {
            let snap = RateLimitSnapshot {
                limit,
                remaining,
                used: header_u32("x-ratelimit-used").unwrap_or(limit.saturating_sub(remaining)),
                reset_epoch: header_i64("x-ratelimit-reset").unwrap_or(0),
                scopes,
            };
            *self.state.latest_rate_limit.write().await = Some(snap.clone());
            Some(snap)
        } else {
            None
        }
    }

    async fn map_error(resp: Response, rate: Option<RateLimitSnapshot>) -> ApiError {
        let status = resp.status().as_u16();
        let body_text = resp.text().await.unwrap_or_default();

        let parsed_msg = serde_json::from_str::<Value>(&body_text)
            .ok()
            .and_then(|val| {
                let base = val.get("message").and_then(|m| m.as_str()).unwrap_or("");
                let details = val
                    .get("errors")
                    .and_then(|e| e.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|item| {
                                item.get("message")
                                    .and_then(|m| m.as_str())
                                    .map(|s| s.to_string())
                                    .or_else(|| {
                                        let field = item.get("field").and_then(|f| f.as_str())?;
                                        let code = item.get("code").and_then(|c| c.as_str())?;
                                        Some(format!("{}: {}", field, code))
                                    })
                            })
                            .collect::<Vec<_>>()
                            .join("; ")
                    })
                    .unwrap_or_default();

                if base.is_empty() && details.is_empty() {
                    None
                } else if details.is_empty() {
                    Some(base.to_string())
                } else {
                    Some(format!("{} ({})", base, details))
                }
            })
            .unwrap_or_else(|| {
                if body_text.is_empty() {
                    format!("GitHub API responded with HTTP {}", status)
                } else {
                    body_text
                }
            });

        match status {
            401 => ApiError::Unauthorized(format!(
                "GitHub rejected the token: {}",
                parsed_msg
            )),
            403 => {
                if let Some(rl) = rate {
                    if rl.remaining == 0 {
                        return ApiError::RateLimited {
                            message: format!("GitHub API rate limit exhausted: {}", parsed_msg),
                            reset_epoch: Some(rl.reset_epoch),
                        };
                    }
                }
                ApiError::Forbidden(format!(
                    "Insufficient token permissions or forbidden by GitHub: {}",
                    parsed_msg
                ))
            }
            404 => ApiError::NotFound(format!(
                "Resource not found on GitHub (or token lacks access): {}",
                parsed_msg
            )),
            409 => ApiError::Conflict(parsed_msg),
            422 => ApiError::Unprocessable(parsed_msg),
            429 => ApiError::RateLimited {
                message: parsed_msg,
                reset_epoch: rate.map(|r| r.reset_epoch),
            },
            _ => ApiError::Upstream {
                status,
                message: parsed_msg,
            },
        }
    }

    async fn send_raw<B: Serialize + ?Sized>(
        &self,
        method: Method,
        path: &str,
        query: Option<&[(String, String)]>,
        body: Option<&B>,
    ) -> Result<(Response, Option<RateLimitSnapshot>), ApiError> {
        let mut req = self
            .state
            .http
            .request(method, self.url(path))
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28");

        if let Some(q) = query {
            if !q.is_empty() {
                req = req.query(q);
            }
        }

        if let Some(b) = body {
            req = req.json(b);
        }

        let resp = req.send().await.map_err(|e| {
            ApiError::Upstream {
                status: 502,
                message: format!("Failed to reach GitHub API: {}", e),
            }
        })?;

        let rate = self.capture_headers(&resp).await;
        if !resp.status().is_success() {
            return Err(Self::map_error(resp, rate).await);
        }

        Ok((resp, rate))
    }

    pub async fn request_json<T: DeserializeOwned, B: Serialize + ?Sized>(
        &self,
        method: Method,
        path: &str,
        query: Option<&[(String, String)]>,
        body: Option<&B>,
    ) -> Result<(T, Option<RateLimitSnapshot>), ApiError> {
        let (resp, rate) = self.send_raw(method, path, query, body).await?;
        let parsed = resp.json::<T>().await.map_err(|e| {
            ApiError::Internal(format!("Failed to parse GitHub JSON payload: {}", e))
        })?;
        Ok((parsed, rate))
    }

    pub async fn request_empty<B: Serialize + ?Sized>(
        &self,
        method: Method,
        path: &str,
        body: Option<&B>,
    ) -> Result<Option<RateLimitSnapshot>, ApiError> {
        let (_resp, rate) = self.send_raw(method, path, None, body).await?;
        Ok(rate)
    }

    pub async fn get_authenticated_user(
        &self,
    ) -> Result<(GitHubUser, Option<RateLimitSnapshot>), ApiError> {
        self.request_json::<GitHubUser, ()>(Method::GET, "/user", None, None)
            .await
    }

    pub async fn list_user_orgs(&self) -> Result<Vec<GitHubOrg>, ApiError> {
        let q = vec![("per_page".to_string(), "100".to_string())];
        let (orgs, _) = self
            .request_json::<Vec<GitHubOrg>, ()>(Method::GET, "/user/orgs", Some(&q), None)
            .await?;
        Ok(orgs)
    }

    pub async fn list_repositories(&self, query: &ListReposQuery) -> Result<Vec<Repository>, ApiError> {
        let visibility = query
            .visibility
            .clone()
            .unwrap_or_else(|| "all".to_string());
        let affiliation = query
            .affiliation
            .clone()
            .unwrap_or_else(|| "owner,collaborator,organization_member".to_string());
        let sort = query.sort.clone().unwrap_or_else(|| "updated".to_string());
        let direction = query.direction.clone().unwrap_or_else(|| "desc".to_string());
        let per_page = query.per_page.unwrap_or(100).clamp(1, 100);

        if let Some(single_page) = query.page {
            let params = vec![
                ("visibility".to_string(), visibility),
                ("affiliation".to_string(), affiliation),
                ("sort".to_string(), sort),
                ("direction".to_string(), direction),
                ("per_page".to_string(), per_page.to_string()),
                ("page".to_string(), single_page.to_string()),
            ];
            let (repos, _) = self
                .request_json::<Vec<Repository>, ()>(Method::GET, "/user/repos", Some(&params), None)
                .await?;
            return Ok(repos);
        }

        // Fetch up to 3 pages (300 repositories) automatically when no page parameter is given
        let mut all_repos = Vec::new();
        for page_num in 1..=3u32 {
            let params = vec![
                ("visibility".to_string(), visibility.clone()),
                ("affiliation".to_string(), affiliation.clone()),
                ("sort".to_string(), sort.clone()),
                ("direction".to_string(), direction.clone()),
                ("per_page".to_string(), "100".to_string()),
                ("page".to_string(), page_num.to_string()),
            ];
            let (batch, _) = self
                .request_json::<Vec<Repository>, ()>(Method::GET, "/user/repos", Some(&params), None)
                .await?;
            let count = batch.len();
            all_repos.extend(batch);
            if count < 100 {
                break;
            }
        }
        Ok(all_repos)
    }

    pub async fn get_repository(&self, owner: &str, repo: &str) -> Result<Repository, ApiError> {
        let path = format!("/repos/{}/{}", Self::enc(owner), Self::enc(repo));
        let (r, _) = self
            .request_json::<Repository, ()>(Method::GET, &path, None, None)
            .await?;
        Ok(r)
    }

    pub async fn create_repository(&self, input: &CreateRepoRequest) -> Result<Repository, ApiError> {
        let mut payload = serde_json::to_value(input)
            .map_err(|e| ApiError::Internal(format!("Serialization error: {}", e)))?;

        if let Some(obj) = payload.as_object_mut() {
            obj.remove("org");
            if let Some(vis) = input.visibility.as_deref() {
                let is_priv = vis == "private" || vis == "internal";
                obj.insert("private".to_string(), json!(is_priv));
            }
        }

        let path = match input.org.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            Some(org_name) => format!("/orgs/{}/repos", Self::enc(org_name)),
            None => "/user/repos".to_string(),
        };

        let (repo, _) = self
            .request_json::<Repository, Value>(Method::POST, &path, None, Some(&payload))
            .await?;
        Ok(repo)
    }

    pub async fn update_repository(
        &self,
        owner: &str,
        repo: &str,
        patch: &UpdateRepoRequest,
    ) -> Result<Repository, ApiError> {
        let mut payload = serde_json::to_value(patch)
            .map_err(|e| ApiError::Internal(format!("Serialization error: {}", e)))?;

        if let Some(obj) = payload.as_object_mut() {
            if let Some(vis) = patch.visibility.as_deref() {
                if vis == "public" || vis == "private" {
                    obj.insert("private".to_string(), json!(vis == "private"));
                }
            }
        }

        let path = format!("/repos/{}/{}", Self::enc(owner), Self::enc(repo));
        let (updated, _) = self
            .request_json::<Repository, Value>(Method::PATCH, &path, None, Some(&payload))
            .await?;
        Ok(updated)
    }

    pub async fn delete_repository(&self, owner: &str, repo: &str) -> Result<(), ApiError> {
        let path = format!("/repos/{}/{}", Self::enc(owner), Self::enc(repo));
        self.request_empty::<()>(Method::DELETE, &path, None).await?;
        Ok(())
    }

    pub async fn get_topics(&self, owner: &str, repo: &str) -> Result<Vec<String>, ApiError> {
        let path = format!("/repos/{}/{}/topics", Self::enc(owner), Self::enc(repo));
        let (res, _) = self
            .request_json::<TopicsPayload, ()>(Method::GET, &path, None, None)
            .await?;
        Ok(res.names)
    }

    pub async fn replace_topics(
        &self,
        owner: &str,
        repo: &str,
        names: Vec<String>,
    ) -> Result<Vec<String>, ApiError> {
        let sanitized = names
            .into_iter()
            .map(|t| t.trim().to_lowercase().replace(' ', "-"))
            .filter(|t| !t.is_empty())
            .collect::<Vec<_>>();
        let path = format!("/repos/{}/{}/topics", Self::enc(owner), Self::enc(repo));
        let body = TopicsPayload { names: sanitized };
        let (res, _) = self
            .request_json::<TopicsPayload, TopicsPayload>(Method::PUT, &path, None, Some(&body))
            .await?;
        Ok(res.names)
    }

    pub async fn transfer_repository(
        &self,
        owner: &str,
        repo: &str,
        req: &TransferRepoRequest,
    ) -> Result<Repository, ApiError> {
        let path = format!("/repos/{}/{}/transfer", Self::enc(owner), Self::enc(repo));
        let (res, _) = self
            .request_json::<Repository, TransferRepoRequest>(Method::POST, &path, None, Some(req))
            .await?;
        Ok(res)
    }

    pub async fn list_branches(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<Vec<BranchSummary>, ApiError> {
        let path = format!("/repos/{}/{}/branches", Self::enc(owner), Self::enc(repo));
        let params = vec![("per_page".to_string(), "100".to_string())];
        let (branches, _) = self
            .request_json::<Vec<BranchSummary>, ()>(Method::GET, &path, Some(&params), None)
            .await?;
        Ok(branches)
    }

    pub async fn create_branch(
        &self,
        owner: &str,
        repo: &str,
        branch_name: &str,
        from_sha: &str,
    ) -> Result<GitRefResponse, ApiError> {
        let clean_name = branch_name.trim().trim_start_matches("refs/heads/");
        if clean_name.is_empty() {
            return Err(ApiError::BadRequest(
                "Branch name cannot be empty.".to_string(),
            ));
        }
        let path = format!("/repos/{}/{}/git/refs", Self::enc(owner), Self::enc(repo));
        let payload = json!({
            "ref": format!("refs/heads/{}", clean_name),
            "sha": from_sha.trim(),
        });
        let (res, _) = self
            .request_json::<GitRefResponse, Value>(Method::POST, &path, None, Some(&payload))
            .await?;
        Ok(res)
    }

    pub async fn rename_branch(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        new_name: &str,
    ) -> Result<BranchSummary, ApiError> {
        let path = format!(
            "/repos/{}/{}/branches/{}/rename",
            Self::enc(owner),
            Self::enc(repo),
            Self::enc(branch)
        );
        let payload = RenameBranchRequest {
            new_name: new_name.trim().to_string(),
        };
        let (res, _) = self
            .request_json::<BranchSummary, RenameBranchRequest>(
                Method::POST,
                &path,
                None,
                Some(&payload),
            )
            .await?;
        Ok(res)
    }

    pub async fn delete_branch(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
    ) -> Result<(), ApiError> {
        let path = format!(
            "/repos/{}/{}/git/refs/heads/{}",
            Self::enc(owner),
            Self::enc(repo),
            Self::enc_path(branch)
        );
        self.request_empty::<()>(Method::DELETE, &path, None).await?;
        Ok(())
    }

    pub async fn get_readme(&self, owner: &str, repo: &str) -> Result<DecodedReadme, ApiError> {
        let path = format!("/repos/{}/{}/readme", Self::enc(owner), Self::enc(repo));
        let (item, _) = self
            .request_json::<ContentItem, ()>(Method::GET, &path, None, None)
            .await?;
        let raw_b64 = item.content.unwrap_or_default().replace(['\n', '\r'], "");
        let decoded_bytes = B64.decode(raw_b64.as_bytes()).unwrap_or_default();
        let decoded_content = String::from_utf8_lossy(&decoded_bytes).into_owned();

        Ok(DecodedReadme {
            name: item.name,
            path: item.path,
            sha: item.sha,
            size: item.size,
            html_url: item.html_url,
            decoded_content,
        })
    }

    pub async fn list_contents(
        &self,
        owner: &str,
        repo: &str,
        subpath: &str,
    ) -> Result<Value, ApiError> {
        let clean = Self::enc_path(subpath);
        let path = if clean.is_empty() {
            format!("/repos/{}/{}/contents", Self::enc(owner), Self::enc(repo))
        } else {
            format!(
                "/repos/{}/{}/contents/{}",
                Self::enc(owner),
                Self::enc(repo),
                clean
            )
        };
        let (val, _) = self
            .request_json::<Value, ()>(Method::GET, &path, None, None)
            .await?;
        Ok(val)
    }

    pub async fn put_file(
        &self,
        owner: &str,
        repo: &str,
        subpath: &str,
        input: &PutFileRequest,
    ) -> Result<Value, ApiError> {
        let clean = Self::enc_path(subpath);
        if clean.is_empty() {
            return Err(ApiError::BadRequest("File path is required.".to_string()));
        }
        let path = format!(
            "/repos/{}/{}/contents/{}",
            Self::enc(owner),
            Self::enc(repo),
            clean
        );
        let encoded = B64.encode(input.content_utf8.as_bytes());
        let mut payload = json!({
            "message": input.message.trim(),
            "content": encoded,
        });
        if let Some(obj) = payload.as_object_mut() {
            if let Some(sha) = input.sha.as_deref().filter(|s| !s.is_empty()) {
                obj.insert("sha".to_string(), json!(sha));
            }
            if let Some(branch) = input.branch.as_deref().filter(|s| !s.is_empty()) {
                obj.insert("branch".to_string(), json!(branch));
            }
        }
        let (res, _) = self
            .request_json::<Value, Value>(Method::PUT, &path, None, Some(&payload))
            .await?;
        Ok(res)
    }

    pub async fn list_issues(
        &self,
        owner: &str,
        repo: &str,
        query: &ListIssuesQuery,
    ) -> Result<Vec<IssueItem>, ApiError> {
        let path = format!("/repos/{}/{}/issues", Self::enc(owner), Self::enc(repo));
        let params = vec![
            (
                "state".to_string(),
                query.state.clone().unwrap_or_else(|| "open".to_string()),
            ),
            (
                "per_page".to_string(),
                query.per_page.unwrap_or(50).clamp(1, 100).to_string(),
            ),
            ("page".to_string(), query.page.unwrap_or(1).to_string()),
        ];
        let (issues, _) = self
            .request_json::<Vec<IssueItem>, ()>(Method::GET, &path, Some(&params), None)
            .await?;
        Ok(issues)
    }

    pub async fn create_issue(
        &self,
        owner: &str,
        repo: &str,
        input: &CreateIssueRequest,
    ) -> Result<IssueItem, ApiError> {
        let path = format!("/repos/{}/{}/issues", Self::enc(owner), Self::enc(repo));
        let (issue, _) = self
            .request_json::<IssueItem, CreateIssueRequest>(Method::POST, &path, None, Some(input))
            .await?;
        Ok(issue)
    }

    pub async fn update_issue(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
        input: &UpdateIssueRequest,
    ) -> Result<IssueItem, ApiError> {
        let path = format!(
            "/repos/{}/{}/issues/{}",
            Self::enc(owner),
            Self::enc(repo),
            number
        );
        let (issue, _) = self
            .request_json::<IssueItem, UpdateIssueRequest>(Method::PATCH, &path, None, Some(input))
            .await?;
        Ok(issue)
    }

    pub async fn list_releases(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<Vec<ReleaseItem>, ApiError> {
        let path = format!("/repos/{}/{}/releases", Self::enc(owner), Self::enc(repo));
        let params = vec![("per_page".to_string(), "50".to_string())];
        let (releases, _) = self
            .request_json::<Vec<ReleaseItem>, ()>(Method::GET, &path, Some(&params), None)
            .await?;
        Ok(releases)
    }

    pub async fn create_release(
        &self,
        owner: &str,
        repo: &str,
        input: &CreateReleaseRequest,
    ) -> Result<ReleaseItem, ApiError> {
        let path = format!("/repos/{}/{}/releases", Self::enc(owner), Self::enc(repo));
        let (release, _) = self
            .request_json::<ReleaseItem, CreateReleaseRequest>(
                Method::POST,
                &path,
                None,
                Some(input),
            )
            .await?;
        Ok(release)
    }

    pub async fn delete_release(
        &self,
        owner: &str,
        repo: &str,
        release_id: u64,
    ) -> Result<(), ApiError> {
        let path = format!(
            "/repos/{}/{}/releases/{}",
            Self::enc(owner),
            Self::enc(repo),
            release_id
        );
        self.request_empty::<()>(Method::DELETE, &path, None).await?;
        Ok(())
    }

    pub async fn list_collaborators(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<Vec<Collaborator>, ApiError> {
        let path = format!(
            "/repos/{}/{}/collaborators",
            Self::enc(owner),
            Self::enc(repo)
        );
        let params = vec![("per_page".to_string(), "100".to_string())];
        let (collabs, _) = self
            .request_json::<Vec<Collaborator>, ()>(Method::GET, &path, Some(&params), None)
            .await?;
        Ok(collabs)
    }

    pub async fn add_collaborator(
        &self,
        owner: &str,
        repo: &str,
        username: &str,
        input: &InviteCollaboratorRequest,
    ) -> Result<Value, ApiError> {
        let path = format!(
            "/repos/{}/{}/collaborators/{}",
            Self::enc(owner),
            Self::enc(repo),
            Self::enc(username)
        );
        let (resp, _) = self
            .send_raw(Method::PUT, &path, None, Some(input))
            .await?;
        if resp.status().as_u16() == 204 {
            return Ok(json!({ "status": "already_collaborator", "username": username }));
        }
        let body = resp
            .json::<Value>()
            .await
            .unwrap_or_else(|_| json!({ "status": "invited", "username": username }));
        Ok(body)
    }

    pub async fn remove_collaborator(
        &self,
        owner: &str,
        repo: &str,
        username: &str,
    ) -> Result<(), ApiError> {
        let path = format!(
            "/repos/{}/{}/collaborators/{}",
            Self::enc(owner),
            Self::enc(repo),
            Self::enc(username)
        );
        self.request_empty::<()>(Method::DELETE, &path, None).await?;
        Ok(())
    }

    pub async fn list_webhooks(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<Vec<WebhookItem>, ApiError> {
        let path = format!("/repos/{}/{}/hooks", Self::enc(owner), Self::enc(repo));
        let (hooks, _) = self
            .request_json::<Vec<WebhookItem>, ()>(Method::GET, &path, None, None)
            .await?;
        Ok(hooks)
    }

    pub async fn create_webhook(
        &self,
        owner: &str,
        repo: &str,
        input: &CreateWebhookInput,
    ) -> Result<WebhookItem, ApiError> {
        let path = format!("/repos/{}/{}/hooks", Self::enc(owner), Self::enc(repo));
        let events = if input.events.is_empty() {
            vec!["push".to_string()]
        } else {
            input.events.clone()
        };
        let mut config = json!({
            "url": input.url.trim(),
            "content_type": input.content_type.clone().unwrap_or_else(|| "json".to_string()),
            "insecure_ssl": "0",
        });
        if let Some(secret) = input.secret.as_deref().filter(|s| !s.is_empty()) {
            if let Some(obj) = config.as_object_mut() {
                obj.insert("secret".to_string(), json!(secret));
            }
        }
        let payload = json!({
            "name": "web",
            "active": input.active.unwrap_or(true),
            "events": events,
            "config": config,
        });
        let (hook, _) = self
            .request_json::<WebhookItem, Value>(Method::POST, &path, None, Some(&payload))
            .await?;
        Ok(hook)
    }

    pub async fn update_webhook(
        &self,
        owner: &str,
        repo: &str,
        hook_id: u64,
        input: &UpdateWebhookInput,
    ) -> Result<WebhookItem, ApiError> {
        let path = format!(
            "/repos/{}/{}/hooks/{}",
            Self::enc(owner),
            Self::enc(repo),
            hook_id
        );
        let mut payload = serde_json::Map::new();
        if let Some(active) = input.active {
            payload.insert("active".to_string(), json!(active));
        }
        if let Some(events) = &input.events {
            payload.insert("events".to_string(), json!(events));
        }
        if input.url.is_some() || input.content_type.is_some() {
            let mut cfg = serde_json::Map::new();
            if let Some(u) = &input.url {
                cfg.insert("url".to_string(), json!(u));
            }
            if let Some(ct) = &input.content_type {
                cfg.insert("content_type".to_string(), json!(ct));
            }
            payload.insert("config".to_string(), Value::Object(cfg));
        }
        let body = Value::Object(payload);
        let (hook, _) = self
            .request_json::<WebhookItem, Value>(Method::PATCH, &path, None, Some(&body))
            .await?;
        Ok(hook)
    }

    pub async fn ping_webhook(
        &self,
        owner: &str,
        repo: &str,
        hook_id: u64,
    ) -> Result<(), ApiError> {
        let path = format!(
            "/repos/{}/{}/hooks/{}/pings",
            Self::enc(owner),
            Self::enc(repo),
            hook_id
        );
        self.request_empty::<()>(Method::POST, &path, None).await?;
        Ok(())
    }

    pub async fn delete_webhook(
        &self,
        owner: &str,
        repo: &str,
        hook_id: u64,
    ) -> Result<(), ApiError> {
        let path = format!(
            "/repos/{}/{}/hooks/{}",
            Self::enc(owner),
            Self::enc(repo),
            hook_id
        );
        self.request_empty::<()>(Method::DELETE, &path, None).await?;
        Ok(())
    }
}
