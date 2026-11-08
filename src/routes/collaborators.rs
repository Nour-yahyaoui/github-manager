use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::InviteCollaboratorRequest;
use crate::state::AppState;
use actix_web::{delete, get, put, web, HttpRequest, HttpResponse};
use serde_json::json;

#[get("/repos/{owner}/{repo}/collaborators")]
pub async fn list_collaborators(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let collabs = gh.list_collaborators(&owner, &repo).await?;
    Ok(HttpResponse::Ok().json(collabs))
}

#[put("/repos/{owner}/{repo}/collaborators/{username}")]
pub async fn add_collaborator(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
    payload: web::Json<InviteCollaboratorRequest>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, username) = path.into_inner();
    if username.trim().is_empty() {
        return Err(ApiError::BadRequest("GitHub username is required.".to_string()));
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let result = gh
        .add_collaborator(&owner, &repo, username.trim(), &payload)
        .await?;

    state
        .record_audit(
            "collaborator.add",
            format!("{}/{}", owner, repo),
            "success",
            format!(
                "Invited/updated @{} ({})",
                username.trim(),
                payload.permission.as_deref().unwrap_or("push")
            ),
        )
        .await;

    Ok(HttpResponse::Ok().json(result))
}

#[delete("/repos/{owner}/{repo}/collaborators/{username}")]
pub async fn remove_collaborator(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, username) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    gh.remove_collaborator(&owner, &repo, username.trim()).await?;

    state
        .record_audit(
            "collaborator.remove",
            format!("{}/{}", owner, repo),
            "success",
            format!("Removed collaborator @{}", username.trim()),
        )
        .await;

    Ok(HttpResponse::Ok().json(json!({
        "removed": true,
        "username": username,
    })))
}
