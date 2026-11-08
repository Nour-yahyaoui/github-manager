use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::{CreateIssueRequest, ListIssuesQuery, UpdateIssueRequest};
use crate::state::AppState;
use actix_web::{get, patch, post, web, HttpRequest, HttpResponse};

#[get("/repos/{owner}/{repo}/issues")]
pub async fn list_issues(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    query: web::Query<ListIssuesQuery>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let issues = gh.list_issues(&owner, &repo, &query).await?;
    Ok(HttpResponse::Ok().json(issues))
}

#[post("/repos/{owner}/{repo}/issues")]
pub async fn create_issue(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    payload: web::Json<CreateIssueRequest>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    if payload.title.trim().is_empty() {
        return Err(ApiError::BadRequest("Issue title is required.".to_string()));
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let created = gh.create_issue(&owner, &repo, &payload).await?;

    state
        .record_audit(
            "issue.create",
            format!("{}/{}#{}", owner, repo, created.number),
            "success",
            format!("Opened issue: {}", created.title),
        )
        .await;

    Ok(HttpResponse::Created().json(created))
}

#[patch("/repos/{owner}/{repo}/issues/{number}")]
pub async fn update_issue(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, u64)>,
    payload: web::Json<UpdateIssueRequest>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, number) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let updated = gh.update_issue(&owner, &repo, number, &payload).await?;

    state
        .record_audit(
            "issue.update",
            format!("{}/{}#{}", owner, repo, number),
            "success",
            format!("State: {} ({})", updated.state, updated.title),
        )
        .await;

    Ok(HttpResponse::Ok().json(updated))
}
