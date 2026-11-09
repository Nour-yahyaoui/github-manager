mod config;
mod error;
mod github;
mod routes;
mod state;

use actix_cors::Cors;
use actix_files::{Files, NamedFile};
use actix_web::{http::header, middleware::Logger, web, App, HttpRequest, HttpResponse, HttpServer};
use config::{AppConfig, ProxyMode};
use state::AppState;
use std::path::PathBuf;
use std::time::Duration;

/// Build the single reqwest client used for every GitHub call.
///
/// Proxy behaviour matters a lot on Windows: reqwest honours the OS proxy
/// settings (Internet Options / VPN clients), while `curl.exe` does not. That
/// makes "curl works but the app cannot connect" a classic symptom, so proxy
/// handling is explicit and logged at startup.
fn build_http_client(cfg: &AppConfig) -> reqwest::Client {
    let mut builder = reqwest::Client::builder()
        .user_agent(concat!("github-manager-actix/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(30));

    match cfg.proxy.mode {
        ProxyMode::Explicit => {
            if let Some(url) = cfg.proxy.url.as_deref() {
                match reqwest::Proxy::all(url) {
                    Ok(proxy) => {
                        builder = builder.proxy(proxy);
                        log::info!("GitHub HTTP client: using {}", cfg.proxy.description());
                    }
                    Err(err) => log::error!(
                        "GITHUB_PROXY is not a valid proxy URL ({}): {} - connecting directly",
                        cfg.proxy.description(),
                        err
                    ),
                }
            }
        }
        ProxyMode::Disabled => {
            builder = builder.no_proxy();
            log::info!(
                "GitHub HTTP client: {} (system/environment proxies ignored)",
                cfg.proxy.description()
            );
        }
        ProxyMode::System => {
            let detected = if cfg.proxy_env_vars.is_empty() {
                "no proxy environment variables set".to_string()
            } else {
                format!("proxy env vars: {}", cfg.proxy_env_vars.join(", "))
            };
            log::info!(
                "GitHub HTTP client: using system proxy settings ({}) - set DISABLE_SYSTEM_PROXY=true to force direct connections",
                detected
            );
        }
    }

    builder
        .build()
        .expect("Failed to initialize reqwest HTTP client")
}

/// Print the real reason when the machine cannot reach GitHub, instead of the
/// bare "error sending request for url (...)" reqwest shows by default.
fn spawn_connectivity_check(client: reqwest::Client, cfg: AppConfig) {
    let Some(token) = cfg.env_token.clone() else {
        return;
    };

    tokio::spawn(async move {
        let url = format!("{}/user", cfg.github_api_base.trim_end_matches('/'));
        match client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
        {
            Ok(resp) => log::info!(
                "GitHub connectivity OK: HTTP {} from {}",
                resp.status().as_u16(),
                url
            ),
            Err(err) => {
                let (chain, hint) = github::client::describe_transport_error(&err);
                log::error!("Cannot reach GitHub API at {}", url);
                log::error!("  reason: {}", chain);
                if let Some(hint) = hint {
                    log::error!("  fix: {}", hint);
                }
                log::error!(
                    "  diagnose: GET http://127.0.0.1:{}/api/v1/diagnostics/connectivity",
                    cfg.port
                );
            }
        }
    });
}

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

    let http_client = build_http_client(&cfg);

    let shared_state = web::Data::new(AppState::new(cfg.clone(), http_client.clone()));

    log::info!(
        "Starting GitHub Manager Actix Web server on http://{}",
        bind_addr
    );
    log::info!("GitHub API base: {}", cfg.github_api_base);
    if cfg.env_token.is_some() {
        log::info!("Loaded GITHUB_PAT from environment (.env)");
    } else {
        log::info!("No GITHUB_PAT in environment — token can be connected at runtime in the web UI");
    }

    spawn_connectivity_check(http_client, cfg.clone());

    let assets_dir = PathBuf::from(&cfg.static_dir).join("assets");

    let allowed_origin_override = std::env::var("CORS_ALLOWED_ORIGIN")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    HttpServer::new(move || {
        let override_origin = allowed_origin_override.clone();
        let cors = Cors::default()
            .allowed_origin_fn(move |origin, _req_head| {
                let Ok(val) = origin.to_str() else {
                    return false;
                };
                if let Some(explicit) = override_origin.as_deref() {
                    if val == explicit {
                        return true;
                    }
                }
                val == "http://localhost"
                    || val.starts_with("http://localhost:")
                    || val == "http://127.0.0.1"
                    || val.starts_with("http://127.0.0.1:")
                    || val.ends_with(".e2b.app")
            })
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
