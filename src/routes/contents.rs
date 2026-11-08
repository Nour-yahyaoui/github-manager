use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::PutFileRequest;
use crate::state::AppState;
use actix_web::{get, put, web, HttpRequest, HttpResponse};

#[get("/repos/{owner}/{repo}/readme")]
pub async fn get_readme(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let readme = gh.get_readme(&owner, &repo).await?;
    Ok(HttpResponse::Ok().json(readme))
}

#[get("/repos/{owner}/{repo}/contents")]
pub async fn list_root_contents(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let items = gh.list_contents(&owner, &repo, "").await?;
    Ok(HttpResponse::Ok().json(items))
}

#[get("/repos/{owner}/{repo}/contents/{subpath:.*}")]
pub async fn get_subpath_contents(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, subpath) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let items = gh.list_contents(&owner, &repo, &subpath).await?;
    Ok(HttpResponse::Ok().json(items))
}

#[put("/repos/{owner}/{repo}/contents/{subpath:.*}")]
pub async fn put_file_contents(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, String)>,
    payload: web::Json<PutFileRequest>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, subpath) = path.into_inner();
    if payload.message.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Commit message is required when updating file contents.".to_string(),
        ));
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let result = gh.put_file(&owner, &repo, &subpath, &payload).await?;

    state
        .record_audit(
            "content.commit",
            format!("{}/{}", owner, repo),
            "success",
            format!("Committed '{}' ({})", subpath, payload.message.trim()),
        )
        .await;

    Ok(HttpResponse::Ok().json(result))
}
