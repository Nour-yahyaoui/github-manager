use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::CreateBranchRequest;
use crate::state::AppState;
use actix_web::{delete, get, post, web, HttpRequest, HttpResponse};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
pub struct BranchRenameBody {
    pub branch: String,
    pub new_name: String,
}

#[get("/repos/{owner}/{repo}/branches")]
pub async fn list_branches(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let branches = gh.list_branches(&owner, &repo).await?;
    Ok(HttpResponse::Ok().json(branches))
}

#[post("/repos/{owner}/{repo}/branches")]
pub async fn create_branch(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    payload: web::Json<CreateBranchRequest>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let created = gh
        .create_branch(&owner, &repo, &payload.branch_name, &payload.from_sha)
        .await?;

    state
        .record_audit(
            "branch.create",
            format!("{}/{}", owner, repo),
            "success",
            format!(
                "Created branch '{}' from {}",
                payload.branch_name.trim(),
                &payload.from_sha.chars().take(7).collect::<String>()
            ),
        )
        .await;

    Ok(HttpResponse::Created().json(created))
}

#[post("/repos/{owner}/{repo}/branches/rename")]
pub async fn rename_branch(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    payload: web::Json<BranchRenameBody>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    if payload.branch.trim().is_empty() || payload.new_name.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Both current branch name and new branch name are required.".to_string(),
        ));
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let updated = gh
        .rename_branch(&owner, &repo, payload.branch.trim(), payload.new_name.trim())
        .await?;

    state
        .record_audit(
            "branch.rename",
            format!("{}/{}", owner, repo),
            "success",
            format!(
                "Renamed branch '{}' -> '{}'",
                payload.branch.trim(),
                payload.new_name.trim()
            ),
        )
        .await;

    Ok(HttpResponse::Ok().json(updated))
}

#[delete("/repos/{owner}/{repo}/branches/{branch:.*}")]
pub async fn delete_branch(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, branch) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    gh.delete_branch(&owner, &repo, &branch).await?;

    state
        .record_audit(
            "branch.delete",
            format!("{}/{}", owner, repo),
            "success",
            format!("Deleted branch '{}'", branch),
        )
        .await;

    Ok(HttpResponse::Ok().json(json!({
        "deleted": true,
        "branch": branch,
    })))
}
