use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::CreateReleaseRequest;
use crate::state::AppState;
use actix_web::{delete, get, post, web, HttpRequest, HttpResponse};
use serde_json::json;

#[get("/repos/{owner}/{repo}/releases")]
pub async fn list_releases(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let releases = gh.list_releases(&owner, &repo).await?;
    Ok(HttpResponse::Ok().json(releases))
}

#[post("/repos/{owner}/{repo}/releases")]
pub async fn create_release(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    payload: web::Json<CreateReleaseRequest>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    if payload.tag_name.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Release tag name (e.g. v0.1.0) is required.".to_string(),
        ));
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let created = gh.create_release(&owner, &repo, &payload).await?;

    state
        .record_audit(
            "release.create",
            format!("{}/{}", owner, repo),
            "success",
            format!(
                "Published {} {}",
                if created.draft { "draft release" } else { "release" },
                created.tag_name
            ),
        )
        .await;

    Ok(HttpResponse::Created().json(created))
}

#[delete("/repos/{owner}/{repo}/releases/{release_id}")]
pub async fn delete_release(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, u64)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, release_id) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    gh.delete_release(&owner, &repo, release_id).await?;

    state
        .record_audit(
            "release.delete",
            format!("{}/{}", owner, repo),
            "success",
            format!("Deleted release #{}", release_id),
        )
        .await;

    Ok(HttpResponse::Ok().json(json!({
        "deleted": true,
        "release_id": release_id,
    })))
}
