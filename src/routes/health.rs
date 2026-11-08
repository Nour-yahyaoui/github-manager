use crate::state::AppState;
use actix_web::{get, web, HttpResponse};
use serde_json::json;

#[get("/health")]
pub async fn health_check(state: web::Data<AppState>) -> HttpResponse {
    let has_env = state.config.env_token.is_some();
    let has_runtime = state.runtime_token.read().await.is_some();
    let rate = state.latest_rate_limit.read().await.clone();

    HttpResponse::Ok().json(json!({
        "status": "ok",
        "server": "actix-web",
        "version": env!("CARGO_PKG_VERSION"),
        "github_api_base": state.config.github_api_base,
        "env_token_present": has_env,
        "session_token_present": has_runtime,
        "rate_limit": rate,
    }))
}
