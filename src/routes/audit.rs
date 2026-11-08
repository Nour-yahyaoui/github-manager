use crate::state::AppState;
use actix_web::{delete, get, web, HttpResponse};
use serde_json::json;

#[get("/audit")]
pub async fn list_audit_entries(state: web::Data<AppState>) -> HttpResponse {
    let entries: Vec<_> = state.audit_log.read().await.iter().cloned().collect();
    HttpResponse::Ok().json(entries)
}

#[delete("/audit")]
pub async fn clear_audit_entries(state: web::Data<AppState>) -> HttpResponse {
    state.audit_log.write().await.clear();
    HttpResponse::Ok().json(json!({ "cleared": true }))
}
