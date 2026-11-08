use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RateLimitSnapshot {
    pub limit: u32,
    pub remaining: u32,
    pub used: u32,
    pub reset_epoch: i64,
    #[serde(default)]
    pub scopes: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub id: u64,
    #[serde(default)]
    pub avatar_url: String,
    #[serde(default)]
    pub html_url: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub bio: Option<String>,
    #[serde(default)]
    pub public_repos: u32,
    #[serde(default)]
    pub total_private_repos: Option<u32>,
    #[serde(default)]
    pub owned_private_repos: Option<u32>,
    #[serde(default)]
    pub followers: u32,
    #[serde(default)]
    pub following: u32,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GitHubOrg {
    pub login: String,
    pub id: u64,
    #[serde(default)]
    pub avatar_url: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthStatusResponse {
    pub authenticated: bool,
    pub token_source: String,
    pub masked_token: Option<String>,
    pub user: Option<GitHubUser>,
    pub rate_limit: Option<RateLimitSnapshot>,
    #[serde(default)]
    pub scopes: Vec<String>,
    pub api_base: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct SetTokenRequest {
    pub token: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RepoOwner {
    pub login: String,
    pub id: u64,
    #[serde(default)]
    pub avatar_url: String,
    #[serde(default)]
    pub html_url: String,
    #[serde(rename = "type", default)]
    pub owner_type: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RepoLicense {
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub spdx_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct RepoPermissions {
    #[serde(default)]
    pub admin: bool,
    #[serde(default)]
    pub maintain: bool,
    #[serde(default)]
    pub push: bool,
    #[serde(default)]
    pub triage: bool,
    #[serde(default)]
    pub pull: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Repository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    #[serde(default)]
    pub private: bool,
    #[serde(default)]
    pub visibility: Option<String>,
    pub owner: RepoOwner,
    #[serde(default)]
    pub html_url: String,
    #[serde(default)]
    pub clone_url: Option<String>,
    #[serde(default)]
    pub ssh_url: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub fork: bool,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub stargazers_count: u64,
    #[serde(default)]
    pub watchers_count: u64,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub has_issues: bool,
    #[serde(default)]
    pub has_projects: bool,
    #[serde(default)]
    pub has_downloads: bool,
    #[serde(default)]
    pub has_wiki: bool,
    #[serde(default)]
    pub has_pages: bool,
    #[serde(default)]
    pub has_discussions: bool,
    #[serde(default)]
    pub forks_count: u64,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub open_issues_count: u64,
    #[serde(default)]
    pub license: Option<RepoLicense>,
    #[serde(default)]
    pub allow_forking: Option<bool>,
    #[serde(default)]
    pub is_template: bool,
    #[serde(default)]
    pub topics: Vec<String>,
    #[serde(default = "default_branch_name")]
    pub default_branch: String,
    #[serde(default)]
    pub allow_squash_merge: Option<bool>,
    #[serde(default)]
    pub allow_merge_commit: Option<bool>,
    #[serde(default)]
    pub allow_rebase_merge: Option<bool>,
    #[serde(default)]
    pub allow_auto_merge: Option<bool>,
    #[serde(default)]
    pub delete_branch_on_merge: Option<bool>,
    #[serde(default)]
    pub allow_update_branch: Option<bool>,
    #[serde(default)]
    pub permissions: Option<RepoPermissions>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub pushed_at: Option<String>,
}

fn default_branch_name() -> String {
    "main".to_string()
}

#[derive(Clone, Debug, Deserialize)]
pub struct ListReposQuery {
    pub visibility: Option<String>,
    pub affiliation: Option<String>,
    pub sort: Option<String>,
    pub direction: Option<String>,
    pub per_page: Option<u32>,
    pub page: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateRepoRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub org: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_issues: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_projects: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_wiki: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_discussions: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_template: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_init: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gitignore_template: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license_template: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_squash_merge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_merge_commit: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_rebase_merge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_auto_merge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete_branch_on_merge: Option<bool>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct UpdateRepoRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_issues: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_projects: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_wiki: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_discussions: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_template: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_squash_merge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_merge_commit: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_rebase_merge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_auto_merge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete_branch_on_merge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_update_branch: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archived: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TopicsPayload {
    pub names: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TransferRepoRequest {
    pub new_owner: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BranchCommitRef {
    pub sha: String,
    #[serde(default)]
    pub url: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BranchSummary {
    pub name: String,
    pub commit: BranchCommitRef,
    #[serde(default)]
    pub protected: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateBranchRequest {
    pub branch_name: String,
    pub from_sha: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RenameBranchRequest {
    pub new_name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GitRefObject {
    pub sha: String,
    #[serde(rename = "type", default)]
    pub obj_type: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GitRefResponse {
    #[serde(rename = "ref")]
    pub git_ref: String,
    pub object: GitRefObject,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ContentItem {
    pub name: String,
    pub path: String,
    pub sha: String,
    #[serde(default)]
    pub size: u64,
    #[serde(rename = "type")]
    pub item_type: String,
    #[serde(default)]
    pub html_url: Option<String>,
    #[serde(default)]
    pub download_url: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub encoding: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DecodedReadme {
    pub name: String,
    pub path: String,
    pub sha: String,
    pub size: u64,
    pub html_url: Option<String>,
    pub decoded_content: String,
}

#[derive(Clone, Debug, Deserialize)]
pub struct PutFileRequest {
    pub message: String,
    pub content_utf8: String,
    #[serde(default)]
    pub sha: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IssueLabel {
    pub id: Option<u64>,
    pub name: String,
    #[serde(default)]
    pub color: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PullRequestMarker {
    #[serde(default)]
    pub html_url: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IssueItem {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub state: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub html_url: String,
    pub user: Option<RepoOwner>,
    #[serde(default)]
    pub labels: Vec<IssueLabel>,
    #[serde(default)]
    pub comments: u32,
    #[serde(default)]
    pub pull_request: Option<PullRequestMarker>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ListIssuesQuery {
    pub state: Option<String>,
    pub per_page: Option<u32>,
    pub page: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateIssueRequest {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateIssueRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub labels: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReleaseItem {
    pub id: u64,
    pub tag_name: String,
    #[serde(default)]
    pub target_commitish: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub draft: bool,
    #[serde(default)]
    pub prerelease: bool,
    #[serde(default)]
    pub html_url: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub published_at: Option<String>,
    pub author: Option<RepoOwner>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateReleaseRequest {
    pub tag_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_commitish: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub draft: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prerelease: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generate_release_notes: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Collaborator {
    pub login: String,
    pub id: u64,
    #[serde(default)]
    pub avatar_url: String,
    #[serde(default)]
    pub html_url: String,
    #[serde(default)]
    pub role_name: Option<String>,
    #[serde(default)]
    pub permissions: Option<RepoPermissions>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InviteCollaboratorRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct WebhookConfig {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub insecure_ssl: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WebhookItem {
    pub id: u64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub active: bool,
    #[serde(default)]
    pub events: Vec<String>,
    #[serde(default)]
    pub config: WebhookConfig,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CreateWebhookInput {
    pub url: String,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub secret: Option<String>,
    #[serde(default)]
    pub events: Vec<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct UpdateWebhookInput {
    #[serde(default)]
    pub active: Option<bool>,
    #[serde(default)]
    pub events: Option<Vec<String>>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub content_type: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BulkAction {
    SetVisibility {
        visibility: String,
    },
    SetArchived {
        archived: bool,
    },
    UpdateFeatures {
        has_issues: Option<bool>,
        has_wiki: Option<bool>,
        has_projects: Option<bool>,
        delete_branch_on_merge: Option<bool>,
        allow_auto_merge: Option<bool>,
    },
    AddTopics {
        topics: Vec<String>,
    },
    ReplaceTopics {
        topics: Vec<String>,
    },
    DeleteRepositories {
        confirm_phrase: String,
    },
}

#[derive(Clone, Debug, Deserialize)]
pub struct BulkReposRequest {
    pub repositories: Vec<String>,
    pub action: BulkAction,
}

#[derive(Clone, Debug, Serialize)]
pub struct BulkRepoResult {
    pub full_name: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct BulkReposResponse {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub results: Vec<BulkRepoResult>,
}
