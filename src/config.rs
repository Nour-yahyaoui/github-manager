use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub env_token: Option<String>,
    pub static_dir: String,
    pub github_api_base: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let _ = dotenvy::dotenv();

        let host = env::var("HOST")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "127.0.0.1".to_string());

        let port = env::var("PORT")
            .ok()
            .and_then(|v| v.trim().parse::<u16>().ok())
            .unwrap_or(8080);

        let env_token = env::var("GITHUB_PAT")
            .or_else(|_| env::var("GH_PAT"))
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && s != "arena-egress-dummy-token");

        let static_dir = env::var("STATIC_DIR")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "./web/dist".to_string());

        let github_api_base = env::var("GITHUB_API_BASE")
            .ok()
            .map(|s| s.trim().trim_end_matches('/').to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "https://api.github.com".to_string());

        Self {
            host,
            port,
            env_token,
            static_dir,
            github_api_base,
        }
    }
}
