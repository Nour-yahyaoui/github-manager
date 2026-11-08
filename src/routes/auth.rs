use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::{AuthStatusResponse, SetTokenRequest};
use crate::state::{mask_token, AppState};
use actix_web::{delete, get, post, web, HttpRequest, HttpResponse};
use serde_json::json;

#[get("/auth/status")]
pub async fn get_auth_status(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ApiError> {
    let Some((token, source)) = state.resolve_optional_token(&req).await else {
        return Ok(HttpResponse::Ok().json(AuthStatusResponse {
            authenticated: false,
            token_source: "none".to_string(),
            masked_token: None,
            user: None,
            rate_limit: None,
            scopes: Vec::new(),
            api_base: state.config.github_api_base.clone(),
        }));
    };

    let gh = GitHubClient::new(&state, token.clone());
    match gh.get_authenticated_user().await {
        Ok((user, rate)) => {
            let scopes = rate
                .as_ref()
                .map(|r| r.scopes.clone())
                .unwrap_or_default();
            Ok(HttpResponse::Ok().json(AuthStatusResponse {
                authenticated: true,
                token_source: source.as_str().to_string(),
                masked_token: Some(mask_token(&token)),
                user: Some(user),
                rate_limit: rate,
                scopes,
                api_base: state.config.github_api_base.clone(),
            }))
        }
        Err(err) => Err(err),
    }
}

#[post("/auth/token")]
pub async fn set_session_token(
    state: web::Data<AppState>,
    payload: web::Json<SetTokenRequest>,
) -> Result<HttpResponse, ApiError> {
    let trimmed = payload.token.trim().to_string();
    if trimmed.is_empty() {
        return Err(ApiError::BadRequest(
            "Personal Access Token cannot be empty.".to_string(),
        ));
    }

    let gh = GitHubClient::new(&state, trimmed.clone());
    let (user, rate) = gh.get_authenticated_user().await?;
    let scopes = rate
        .as_ref()
        .map(|r| r.scopes.clone())
        .unwrap_or_default();

    *state.runtime_token.write().await = Some(trimmed.clone());

    state
        .record_audit(
            "auth.connect_token",
            format!("@{}", user.login),
            "success",
            format!("Connected GitHub PAT ({})", mask_token(&trimmed)),
        )
        .await;

    Ok(HttpResponse::Ok().json(AuthStatusResponse {
        authenticated: true,
        token_source: "runtime_session".to_string(),
        masked_token: Some(mask_token(&trimmed)),
        user: Some(user),
        rate_limit: rate,
        scopes,
        api_base: state.config.github_api_base.clone(),
    }))
}

#[delete("/auth/token")]
pub async fn clear_session_token(state: web::Data<AppState>) -> HttpResponse {
    *state.runtime_token.write().await = None;
    state
        .record_audit(
            "auth.disconnect_token",
            "session",
            "success",
            "Cleared runtime GitHub token from Actix session memory.",
        )
        .await;

    HttpResponse::Ok().json(json!({
        "cleared": true,
        "env_token_fallback_present": state.config.env_token.is_some(),
    }))
}

#[get("/orgs")]
pub async fn list_orgs(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> Result<HttpResponse, ApiError> {
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let orgs = gh.list_user_orgs().await?;
    Ok(HttpResponse::Ok().json(orgs))
}
