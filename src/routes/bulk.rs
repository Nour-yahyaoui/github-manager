use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::{
    BulkAction, BulkRepoResult, BulkReposRequest, BulkReposResponse, UpdateRepoRequest,
};
use crate::state::AppState;
use actix_web::{post, web, HttpRequest, HttpResponse};
use std::collections::BTreeSet;

#[post("/bulk/repos")]
pub async fn execute_bulk_repos(
    req: HttpRequest,
    state: web::Data<AppState>,
    payload: web::Json<BulkReposRequest>,
) -> Result<HttpResponse, ApiError> {
    if payload.repositories.is_empty() {
        return Err(ApiError::BadRequest(
            "Select at least one repository for batch execution.".to_string(),
        ));
    }

    if let BulkAction::DeleteRepositories { confirm_phrase } = &payload.action {
        if confirm_phrase.trim() != "DELETE SELECTED" {
            return Err(ApiError::BadRequest(
                "Type 'DELETE SELECTED' exactly to confirm batch repository deletion.".to_string(),
            ));
        }
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);

    let mut results = Vec::with_capacity(payload.repositories.len());
    let mut succeeded = 0usize;
    let mut failed = 0usize;

    for full_name in &payload.repositories {
        let Some((owner, repo)) = full_name.split_once('/') else {
            failed += 1;
            results.push(BulkRepoResult {
                full_name: full_name.clone(),
                ok: false,
                message: "Invalid owner/repo identifier.".to_string(),
            });
            continue;
        };

        let outcome: Result<String, ApiError> = match &payload.action {
            BulkAction::SetVisibility { visibility } => {
                let vis = visibility.trim().to_lowercase();
                if vis != "public" && vis != "private" {
                    Err(ApiError::BadRequest(
                        "Visibility must be 'public' or 'private'.".to_string(),
                    ))
                } else {
                    let patch = UpdateRepoRequest {
                        private: Some(vis == "private"),
                        visibility: Some(vis.clone()),
                        ..Default::default()
                    };
                    gh.update_repository(owner, repo, &patch)
                        .await
                        .map(|_| format!("Visibility set to {}", vis))
                }
            }
            BulkAction::SetArchived { archived } => {
                let patch = UpdateRepoRequest {
                    archived: Some(*archived),
                    ..Default::default()
                };
                gh.update_repository(owner, repo, &patch).await.map(|_| {
                    if *archived {
                        "Archived repository".to_string()
                    } else {
                        "Unarchived repository".to_string()
                    }
                })
            }
            BulkAction::UpdateFeatures {
                has_issues,
                has_wiki,
                has_projects,
                delete_branch_on_merge,
                allow_auto_merge,
            } => {
                let patch = UpdateRepoRequest {
                    has_issues: *has_issues,
                    has_wiki: *has_wiki,
                    has_projects: *has_projects,
                    delete_branch_on_merge: *delete_branch_on_merge,
                    allow_auto_merge: *allow_auto_merge,
                    ..Default::default()
                };
                gh.update_repository(owner, repo, &patch)
                    .await
                    .map(|_| "Updated repository feature & merge policies".to_string())
            }
            BulkAction::AddTopics { topics } => match gh.get_topics(owner, repo).await {
                Ok(existing) => {
                    let mut merged: BTreeSet<String> = existing.into_iter().collect();
                    for t in topics {
                        let clean = t.trim().to_lowercase().replace(' ', "-");
                        if !clean.is_empty() {
                            merged.insert(clean);
                        }
                    }
                    let next: Vec<String> = merged.into_iter().collect();
                    gh.replace_topics(owner, repo, next)
                        .await
                        .map(|updated| format!("Topics ({})", updated.join(", ")))
                }
                Err(e) => Err(e),
            },
            BulkAction::ReplaceTopics { topics } => gh
                .replace_topics(owner, repo, topics.clone())
                .await
                .map(|updated| format!("Replaced topics ({})", updated.join(", "))),
            BulkAction::DeleteRepositories { .. } => gh
                .delete_repository(owner, repo)
                .await
                .map(|_| "Deleted repository".to_string()),
        };

        match outcome {
            Ok(msg) => {
                succeeded += 1;
                results.push(BulkRepoResult {
                    full_name: full_name.clone(),
                    ok: true,
                    message: msg,
                });
            }
            Err(err) => {
                failed += 1;
                results.push(BulkRepoResult {
                    full_name: full_name.clone(),
                    ok: false,
                    message: err.to_string(),
                });
            }
        }
    }

    state
        .record_audit(
            "bulk.execute",
            format!("{} repo(s)", payload.repositories.len()),
            if failed == 0 { "success" } else { "partial" },
            format!("{} succeeded, {} failed", succeeded, failed),
        )
        .await;

    Ok(HttpResponse::Ok().json(BulkReposResponse {
        total: payload.repositories.len(),
        succeeded,
        failed,
        results,
    }))
}
