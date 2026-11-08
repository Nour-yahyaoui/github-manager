use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::{CreateWebhookInput, UpdateWebhookInput};
use crate::state::AppState;
use actix_web::{delete, get, patch, post, web, HttpRequest, HttpResponse};
use serde_json::json;

#[get("/repos/{owner}/{repo}/hooks")]
pub async fn list_webhooks(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let hooks = gh.list_webhooks(&owner, &repo).await?;
    Ok(HttpResponse::Ok().json(hooks))
}

#[post("/repos/{owner}/{repo}/hooks")]
pub async fn create_webhook(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    payload: web::Json<CreateWebhookInput>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    if payload.url.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Webhook payload URL is required.".to_string(),
        ));
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let created = gh.create_webhook(&owner, &repo, &payload).await?;

    state
        .record_audit(
            "webhook.create",
            format!("{}/{}", owner, repo),
            "success",
            format!("Registered webhook #{} -> {}", created.id, payload.url.trim()),
        )
        .await;

    Ok(HttpResponse::Created().json(created))
}

#[patch("/repos/{owner}/{repo}/hooks/{hook_id}")]
pub async fn update_webhook(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, u64)>,
    payload: web::Json<UpdateWebhookInput>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, hook_id) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let updated = gh
        .update_webhook(&owner, &repo, hook_id, &payload)
        .await?;

    state
        .record_audit(
            "webhook.update",
            format!("{}/{}", owner, repo),
            "success",
            format!(
                "Updated webhook #{} (active={})",
                hook_id, updated.active
            ),
        )
        .await;

    Ok(HttpResponse::Ok().json(updated))
}

#[post("/repos/{owner}/{repo}/hooks/{hook_id}/pings")]
pub async fn ping_webhook(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, u64)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, hook_id) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    gh.ping_webhook(&owner, &repo, hook_id).await?;

    state
        .record_audit(
            "webhook.ping",
            format!("{}/{}", owner, repo),
            "success",
            format!("Sent test ping to webhook #{}", hook_id),
        )
        .await;

    Ok(HttpResponse::Ok().json(json!({ "pinged": true, "hook_id": hook_id })))
}

#[delete("/repos/{owner}/{repo}/hooks/{hook_id}")]
pub async fn delete_webhook(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String, u64)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo, hook_id) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    gh.delete_webhook(&owner, &repo, hook_id).await?;

    state
        .record_audit(
            "webhook.delete",
            format!("{}/{}", owner, repo),
            "success",
            format!("Deleted webhook #{}", hook_id),
        )
        .await;

    Ok(HttpResponse::Ok().json(json!({ "deleted": true, "hook_id": hook_id })))
}
