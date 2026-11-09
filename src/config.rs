use std::env;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProxyMode {
    /// Let reqwest use environment variables and (on Windows/macOS) the OS proxy settings.
    System,
    /// Use the proxy URL taken from `GITHUB_PROXY`.
    Explicit,
    /// Force direct connections, ignoring every proxy setting.
    Disabled,
}

#[derive(Clone, Debug)]
pub struct ProxyConfig {
    pub mode: ProxyMode,
    pub url: Option<String>,
}

impl ProxyConfig {
    pub fn label(&self) -> &'static str {
        match self.mode {
            ProxyMode::System => "system",
            ProxyMode::Explicit => "explicit",
            ProxyMode::Disabled => "disabled",
        }
    }

    /// Human-readable summary that never leaks proxy credentials.
    pub fn description(&self) -> String {
        match (self.mode, self.url.as_deref()) {
            (ProxyMode::Explicit, Some(url)) => format!("explicit proxy {}", mask_proxy_url(url)),
            (ProxyMode::Disabled, _) => {
                "direct connections (system proxy detection disabled)".to_string()
            }
            _ => "system/environment proxy detection".to_string(),
        }
    }
}

fn mask_proxy_url(url: &str) -> String {
    // Hide "user:password@" if present.
    match url.rsplit_once('@') {
        Some((_credentials, host)) => {
            let scheme = url.split_once("://").map(|(s, _)| s).unwrap_or("http");
            format!("{}://***@{}", scheme, host)
        }
        None => url.to_string(),
    }
}

fn truthy(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

const PROXY_ENV_VARS: [&str; 8] = [
    "HTTPS_PROXY",
    "https_proxy",
    "HTTP_PROXY",
    "http_proxy",
    "ALL_PROXY",
    "all_proxy",
    "NO_PROXY",
    "no_proxy",
];

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub env_token: Option<String>,
    pub static_dir: String,
    pub github_api_base: String,
    pub proxy: ProxyConfig,
    pub proxy_env_vars: Vec<String>,
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

        let explicit_proxy = env::var("GITHUB_PROXY")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let disable_system_proxy = env::var("DISABLE_SYSTEM_PROXY")
            .ok()
            .map(|v| truthy(&v))
            .unwrap_or(false);

        let proxy = match (explicit_proxy, disable_system_proxy) {
            (Some(url), _) => ProxyConfig {
                mode: ProxyMode::Explicit,
                url: Some(url),
            },
            (None, true) => ProxyConfig {
                mode: ProxyMode::Disabled,
                url: None,
            },
            (None, false) => ProxyConfig {
                mode: ProxyMode::System,
                url: None,
            },
        };

        let proxy_env_vars = PROXY_ENV_VARS
            .iter()
            .filter(|name| {
                env::var(name)
                    .map(|v| !v.trim().is_empty())
                    .unwrap_or(false)
            })
            .map(|name| (*name).to_string())
            .collect();

        Self {
            host,
            port,
            env_token,
            static_dir,
            github_api_base,
            proxy,
            proxy_env_vars,
        }
    }
}
