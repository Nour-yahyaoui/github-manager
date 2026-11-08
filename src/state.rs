use crate::config::AppConfig;
use crate::error::ApiError;
use crate::github::models::RateLimitSnapshot;
use actix_web::HttpRequest;
use chrono::Utc;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::RwLock;

const MAX_AUDIT_ENTRIES: usize = 250;

#[derive(Clone, Debug, Serialize)]
pub struct AuditEntry {
    pub id: u64,
    pub timestamp: String,
    pub action: String,
    pub target: String,
    pub status: String,
    pub detail: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenSource {
    Header,
    Session,
    Env,
}

impl TokenSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            TokenSource::Header => "request_header",
            TokenSource::Session => "runtime_session",
            TokenSource::Env => "env_file",
        }
    }
}

pub struct AppState {
    pub config: AppConfig,
    pub http: reqwest::Client,
    pub runtime_token: RwLock<Option<String>>,
    pub latest_rate_limit: RwLock<Option<RateLimitSnapshot>>,
    pub audit_log: RwLock<VecDeque<AuditEntry>>,
    audit_seq: AtomicU64,
}

impl AppState {
    pub fn new(config: AppConfig, http: reqwest::Client) -> Self {
        Self {
            config,
            http,
            runtime_token: RwLock::new(None),
            latest_rate_limit: RwLock::new(None),
            audit_log: RwLock::new(VecDeque::with_capacity(MAX_AUDIT_ENTRIES)),
            audit_seq: AtomicU64::new(1),
        }
    }

    pub async fn resolve_optional_token(&self, req: &HttpRequest) -> Option<(String, TokenSource)> {
        if let Some(hdr) = req.headers().get("X-GitHub-Token") {
            if let Ok(raw) = hdr.to_str() {
                let trimmed = raw.trim();
                if !trimmed.is_empty() {
                    return Some((trimmed.to_string(), TokenSource::Header));
                }
            }
        }

        if let Some(tok) = self.runtime_token.read().await.clone() {
            if !tok.is_empty() {
                return Some((tok, TokenSource::Session));
            }
        }

        if let Some(tok) = self.config.env_token.clone() {
            if !tok.is_empty() {
                return Some((tok, TokenSource::Env));
            }
        }

        None
    }

    pub async fn require_token(&self, req: &HttpRequest) -> Result<(String, TokenSource), ApiError> {
        self.resolve_optional_token(req).await.ok_or_else(|| {
            ApiError::Unauthorized(
                "No GitHub Personal Access Token configured. Set GITHUB_PAT in .env or connect a token in Token & Connection.".to_string(),
            )
        })
    }

    pub async fn record_audit(
        &self,
        action: impl Into<String>,
        target: impl Into<String>,
        status: impl Into<String>,
        detail: impl Into<String>,
    ) {
        let entry = AuditEntry {
            id: self.audit_seq.fetch_add(1, Ordering::Relaxed),
            timestamp: Utc::now().to_rfc3339(),
            action: action.into(),
            target: target.into(),
            status: status.into(),
            detail: detail.into(),
        };

        let mut log = self.audit_log.write().await;
        log.push_front(entry);
        while log.len() > MAX_AUDIT_ENTRIES {
            log.pop_back();
        }
    }
}

pub fn mask_token(token: &str) -> String {
    let chars: Vec<char> = token.chars().collect();
    if chars.len() <= 10 {
        return "••••••••".to_string();
    }
    let prefix: String = chars.iter().take(6).collect();
    let suffix: String = chars.iter().skip(chars.len() - 4).collect();
    format!("{}••••{}", prefix, suffix)
}
