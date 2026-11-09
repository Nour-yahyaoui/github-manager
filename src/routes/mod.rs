pub mod audit;
pub mod auth;
pub mod branches;
pub mod bulk;
pub mod collaborators;
pub mod contents;
pub mod diagnostics;
pub mod health;
pub mod issues;
pub mod releases;
pub mod repos;
pub mod webhooks;

use actix_web::{web, HttpResponse};
use serde_json::json;

pub fn configure_api(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .service(health::health_check)
            .service(diagnostics::connectivity)
            .service(auth::get_auth_status)
            .service(auth::set_session_token)
            .service(auth::clear_session_token)
            .service(auth::list_orgs)
            .service(audit::list_audit_entries)
            .service(audit::clear_audit_entries)
            .service(bulk::execute_bulk_repos)
            .service(repos::list_repos)
            .service(repos::create_repo)
            .service(repos::get_repo_topics)
            .service(repos::replace_repo_topics)
            .service(repos::transfer_repo)
            .service(branches::list_branches)
            .service(branches::create_branch)
            .service(branches::rename_branch)
            .service(branches::delete_branch)
            .service(contents::get_readme)
            .service(contents::list_root_contents)
            .service(contents::get_subpath_contents)
            .service(contents::put_file_contents)
            .service(issues::list_issues)
            .service(issues::create_issue)
            .service(issues::update_issue)
            .service(releases::list_releases)
            .service(releases::create_release)
            .service(releases::delete_release)
            .service(collaborators::list_collaborators)
            .service(collaborators::add_collaborator)
            .service(collaborators::remove_collaborator)
            .service(webhooks::list_webhooks)
            .service(webhooks::create_webhook)
            .service(webhooks::update_webhook)
            .service(webhooks::ping_webhook)
            .service(webhooks::delete_webhook)
            .service(repos::get_repo)
            .service(repos::update_repo)
            .service(repos::delete_repo)
            .default_service(web::to(|| async {
                HttpResponse::NotFound().json(json!({
                    "error": {
                        "code": "API_ROUTE_NOT_FOUND",
                        "message": "Unknown API endpoint.",
                        "status": 404
                    }
                }))
            })),
    );
}
