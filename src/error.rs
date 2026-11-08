use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::Serialize;
use std::fmt;

#[derive(Debug)]
pub enum ApiError {
    Unauthorized(String),
    BadRequest(String),
    Forbidden(String),
    NotFound(String),
    Conflict(String),
    Unprocessable(String),
    RateLimited {
        message: String,
        reset_epoch: Option<i64>,
    },
    Upstream {
        status: u16,
        message: String,
    },
    Internal(String),
}

#[derive(Serialize)]
struct ErrorEnvelope {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
    status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    reset_epoch: Option<i64>,
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ApiError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            ApiError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            ApiError::Forbidden(msg) => write!(f, "Forbidden: {}", msg),
            ApiError::NotFound(msg) => write!(f, "Not found: {}", msg),
            ApiError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            ApiError::Unprocessable(msg) => write!(f, "Validation error: {}", msg),
            ApiError::RateLimited { message, .. } => write!(f, "Rate limited: {}", message),
            ApiError::Upstream { status, message } => {
                write!(f, "GitHub API error ({}): {}", status, message)
            }
            ApiError::Internal(msg) => write!(f, "Internal server error: {}", msg),
        }
    }
}

impl std::error::Error for ApiError {}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        match self {
            ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ApiError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApiError::Forbidden(_) => StatusCode::FORBIDDEN,
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::Conflict(_) => StatusCode::CONFLICT,
            ApiError::Unprocessable(_) => StatusCode::UNPROCESSABLE_ENTITY,
            ApiError::RateLimited { .. } => StatusCode::TOO_MANY_REQUESTS,
            ApiError::Upstream { status, .. } => {
                StatusCode::from_u16(*status).unwrap_or(StatusCode::BAD_GATEWAY)
            }
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        let (code, message, reset_epoch) = match self {
            ApiError::Unauthorized(m) => ("UNAUTHORIZED", m.clone(), None),
            ApiError::BadRequest(m) => ("BAD_REQUEST", m.clone(), None),
            ApiError::Forbidden(m) => ("FORBIDDEN", m.clone(), None),
            ApiError::NotFound(m) => ("NOT_FOUND", m.clone(), None),
            ApiError::Conflict(m) => ("CONFLICT", m.clone(), None),
            ApiError::Unprocessable(m) => ("UNPROCESSABLE_ENTITY", m.clone(), None),
            ApiError::RateLimited {
                message,
                reset_epoch,
            } => ("RATE_LIMITED", message.clone(), *reset_epoch),
            ApiError::Upstream { message, .. } => ("GITHUB_UPSTREAM_ERROR", message.clone(), None),
            ApiError::Internal(m) => ("INTERNAL_ERROR", m.clone(), None),
        };

        HttpResponse::build(status).json(ErrorEnvelope {
            error: ErrorBody {
                code,
                message,
                status: status.as_u16(),
                reset_epoch,
            },
        })
    }
}
