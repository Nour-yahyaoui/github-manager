use crate::error::ApiError;
use crate::github::client::GitHubClient;
use crate::github::models::{
    CreateRepoRequest, ListReposQuery, TopicsPayload, TransferRepoRequest, UpdateRepoRequest,
};
use crate::state::AppState;
use actix_web::{delete, get, patch, post, put, web, HttpRequest, HttpResponse};
use serde_json::json;

#[get("/repos")]
pub async fn list_repos(
    req: HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<ListReposQuery>,
) -> Result<HttpResponse, ApiError> {
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let repos = gh.list_repositories(&query).await?;
    Ok(HttpResponse::Ok().json(repos))
}

#[post("/repos")]
pub async fn create_repo(
    req: HttpRequest,
    state: web::Data<AppState>,
    payload: web::Json<CreateRepoRequest>,
) -> Result<HttpResponse, ApiError> {
    if payload.name.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Repository name is required.".to_string(),
        ));
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let created = gh.create_repository(&payload).await?;

    state
        .record_audit(
            "repo.create",
            &created.full_name,
            "success",
            format!(
                "Created {} repository",
                if created.private { "private" } else { "public" }
            ),
        )
        .await;

    Ok(HttpResponse::Created().json(created))
}

#[get("/repos/{owner}/{repo}")]
pub async fn get_repo(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let repository = gh.get_repository(&owner, &repo).await?;
    Ok(HttpResponse::Ok().json(repository))
}

#[patch("/repos/{owner}/{repo}")]
pub async fn update_repo(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    payload: web::Json<UpdateRepoRequest>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let target_before = format!("{}/{}", owner, repo);

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let updated = gh.update_repository(&owner, &repo, &payload).await?;

    let mut summary_parts = Vec::new();
    if let Some(new_name) = &payload.name {
        if new_name != &repo {
            summary_parts.push(format!("renamed to {}", new_name));
        }
    }
    if let Some(vis) = &payload.visibility {
        summary_parts.push(format!("visibility -> {}", vis));
    } else if let Some(priv_flag) = payload.private {
        summary_parts.push(format!(
            "visibility -> {}",
            if priv_flag { "private" } else { "public" }
        ));
    }
    if payload.description.is_some() {
        summary_parts.push("updated description".to_string());
    }
    if payload.homepage.is_some() {
        summary_parts.push("updated homepage".to_string());
    }
    if let Some(arch) = payload.archived {
        summary_parts.push(if arch {
            "archived repository".to_string()
        } else {
            "unarchived repository".to_string()
        });
    }
    if let Some(branch) = &payload.default_branch {
        summary_parts.push(format!("default branch -> {}", branch));
    }
    if summary_parts.is_empty() {
        summary_parts.push("updated repository settings".to_string());
    }

    state
        .record_audit(
            "repo.update",
            &updated.full_name,
            "success",
            format!("{} ({})", summary_parts.join(", "), target_before),
        )
        .await;

    Ok(HttpResponse::Ok().json(updated))
}

#[delete("/repos/{owner}/{repo}")]
pub async fn delete_repo(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let full_name = format!("{}/{}", owner, repo);

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    gh.delete_repository(&owner, &repo).await?;

    state
        .record_audit(
            "repo.delete",
            &full_name,
            "success",
            "Permanently deleted repository on GitHub",
        )
        .await;

    Ok(HttpResponse::Ok().json(json!({
        "deleted": true,
        "full_name": full_name,
    })))
}

#[get("/repos/{owner}/{repo}/topics")]
pub async fn get_repo_topics(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let names = gh.get_topics(&owner, &repo).await?;
    Ok(HttpResponse::Ok().json(TopicsPayload { names }))
}

#[put("/repos/{owner}/{repo}/topics")]
pub async fn replace_repo_topics(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    payload: web::Json<TopicsPayload>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    let full_name = format!("{}/{}", owner, repo);

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let names = gh
        .replace_topics(&owner, &repo, payload.names.clone())
        .await?;

    state
        .record_audit(
            "repo.topics",
            &full_name,
            "success",
            format!("Updated {} topic(s): {}", names.len(), names.join(", ")),
        )
        .await;

    Ok(HttpResponse::Ok().json(TopicsPayload { names }))
}

#[post("/repos/{owner}/{repo}/transfer")]
pub async fn transfer_repo(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    payload: web::Json<TransferRepoRequest>,
) -> Result<HttpResponse, ApiError> {
    let (owner, repo) = path.into_inner();
    if payload.new_owner.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Destination owner username or organization is required.".to_string(),
        ));
    }

    let (token, _) = state.require_token(&req).await?;
    let gh = GitHubClient::new(&state, token);
    let transferred = gh.transfer_repository(&owner, &repo, &payload).await?;

    state
        .record_audit(
            "repo.transfer",
            format!("{}/{}", owner, repo),
            "success",
            format!("Initiated transfer to @{}", payload.new_owner.trim()),
        )
        .await;

    Ok(HttpResponse::Accepted().json(transferred))
}
