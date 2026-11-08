mod config;
mod error;
mod github;
mod routes;
mod state;

use actix_cors::Cors;
use actix_files::{Files, NamedFile};
use actix_web::{http::header, middleware::Logger, web, App, HttpRequest, HttpResponse, HttpServer};
use config::AppConfig;
use state::AppState;
use std::path::PathBuf;
use std::time::Duration;

async fn spa_fallback(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    let req_path = req.path().trim_start_matches('/');
    let static_root = PathBuf::from(&state.config.static_dir);

    if !req_path.is_empty() && !req_path.contains("..") {
        let candidate = static_root.join(req_path);
        if candidate.is_file() {
            if let Ok(file) = NamedFile::open_async(candidate).await {
                return file.into_response(&req);
            }
        }
    }

    let index_path = static_root.join("index.html");
    if index_path.is_file() {
        if let Ok(file) = NamedFile::open_async(index_path).await {
            return file.into_response(&req);
        }
    }

    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(
            r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GitHub Manager — Actix Web Server Running</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; color: #15181e; line-height: 1.6; }
    code { background: #eef0f4; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.92em; }
    pre { background: #12161f; color: #e6edf3; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>GitHub Manager API is online</h1>
  <p>The Actix Web server is running and ready at <code>/api/v1/health</code>.</p>
  <p>To build and serve the frontend UI from this port, run:</p>
  <pre>cd web && npm install && npm run build</pre>
  <p>Or run the frontend dev server with hot reload:</p>
  <pre>cd web && npm install && npm run dev</pre>
</body>
</html>"#,
        )
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let cfg = AppConfig::from_env();
    let bind_addr = format!("{}:{}", cfg.host, cfg.port);

    let http_client = reqwest::Client::builder()
        .user_agent(concat!("github-manager-actix/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to initialize reqwest HTTP client");

    let shared_state = web::Data::new(AppState::new(cfg.clone(), http_client));

    log::info!("Starting GitHub Manager Actix Web server on http://{}", bind_addr);
    if cfg.env_token.is_some() {
        log::info!("Loaded GITHUB_PAT from environment (.env)");
    } else {
        log::info!("No GITHUB_PAT in environment — token can be connected at runtime in the web UI");
    }

    let assets_dir = PathBuf::from(&cfg.static_dir).join("assets");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allowed_methods(vec!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                header::AUTHORIZATION,
                header::ACCEPT,
                header::CONTENT_TYPE,
                header::HeaderName::from_static("x-github-token"),
            ])
            .max_age(3600);

        let mut app = App::new()
            .wrap(Logger::default())
            .wrap(cors)
            .app_data(shared_state.clone())
            .app_data(web::JsonConfig::default().limit(2 * 1024 * 1024))
            .configure(routes::configure_api);

        if assets_dir.is_dir() {
            app = app.service(Files::new("/assets", assets_dir.clone()));
        }

        app.default_service(web::to(spa_fallback))
    })
    .bind(&bind_addr)?
    .run()
    .await
}
