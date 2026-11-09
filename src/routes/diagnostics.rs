use crate::github::client::describe_transport_error;
use crate::state::AppState;
use actix_web::{get, web, HttpResponse};
use serde_json::{json, Value};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};

#[derive(Default)]
struct SocketProbe {
    dns_error: Option<String>,
    addresses: Vec<String>,
    tcp: Vec<Value>,
}

/// Step-by-step connectivity report for the machine that runs this server.
/// The browser is never involved: this is the same process and the same HTTP
/// client that talks to GitHub for every real API call.
#[get("/diagnostics/connectivity")]
pub async fn connectivity(state: web::Data<AppState>) -> HttpResponse {
    let api_base = state.config.github_api_base.clone();

    let parsed = match reqwest::Url::parse(&api_base) {
        Ok(url) => url,
        Err(err) => {
            return HttpResponse::Ok().json(json!({
                "ok": false,
                "api_base": api_base,
                "verdict": "invalid_api_base",
                "message": format!("GITHUB_API_BASE is not a valid URL: {}", err),
                "proxy": {
                    "mode": state.config.proxy.label(),
                    "description": state.config.proxy.description(),
                    "env_vars": state.config.proxy_env_vars.clone(),
                },
            }));
        }
    };

    let host = parsed.host_str().unwrap_or_default().to_string();
    let port = parsed.port_or_known_default().unwrap_or(443);

    let host_for_task = host.clone();
    let probe = tokio::task::spawn_blocking(move || {
        let mut probe = SocketProbe::default();

        let addrs: Vec<SocketAddr> = match (host_for_task.as_str(), port).to_socket_addrs() {
            Ok(iter) => iter.collect(),
            Err(err) => {
                probe.dns_error = Some(err.to_string());
                return probe;
            }
        };

        for addr in &addrs {
            probe.addresses.push(addr.to_string());
            let started = Instant::now();
            match TcpStream::connect_timeout(addr, Duration::from_secs(6)) {
                Ok(_) => probe.tcp.push(json!({
                    "address": addr.to_string(),
                    "ok": true,
                    "ms": started.elapsed().as_millis() as u64,
                })),
                Err(err) => probe.tcp.push(json!({
                    "address": addr.to_string(),
                    "ok": false,
                    "error": err.to_string(),
                })),
            }
        }

        probe
    })
    .await;

    let probe = match probe {
        Ok(probe) => probe,
        Err(err) => SocketProbe {
            dns_error: Some(format!("Probe task failed: {}", err)),
            addresses: Vec::new(),
            tcp: Vec::new(),
        },
    };

    // Full HTTPS round trip through the very same client GitHub calls use,
    // so proxy/TLS problems show up exactly as they do in production.
    let zen_url = format!("{}/zen", api_base.trim_end_matches('/'));
    let started = Instant::now();
    let https = match state
        .http
        .get(&zen_url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
    {
        Ok(resp) => json!({
            "ok": resp.status().is_success(),
            "status": resp.status().as_u16(),
            "ms": started.elapsed().as_millis() as u64,
            "url": zen_url,
        }),
        Err(err) => {
            let (chain, hint) = describe_transport_error(&err);
            json!({
                "ok": false,
                "url": zen_url,
                "error": chain,
                "hint": hint,
            })
        }
    };

    let https_ok = https.get("ok").and_then(Value::as_bool).unwrap_or(false);
    let any_tcp_ok = probe
        .tcp
        .iter()
        .any(|entry| entry.get("ok").and_then(Value::as_bool).unwrap_or(false));

    let (ok, verdict, message) = if https_ok {
        (
            true,
            "reachable",
            "This server can reach the GitHub API. If the UI still fails, the problem is \
             the token itself (scopes/expiry) rather than the network."
                .to_string(),
        )
    } else if let Some(dns_error) = probe.dns_error.clone() {
        (
            false,
            "dns_failure",
            format!(
                "The host name could not be resolved ({}). DNS, a VPN or a hosts-file entry \
                 is blocking api.github.com.",
                dns_error
            ),
        )
    } else if !any_tcp_ok {
        (
            false,
            "tcp_blocked",
            "The host name resolves but no TCP connection to port 443 succeeded. A firewall, \
             antivirus or VPN is dropping outbound HTTPS from this binary."
                .to_string(),
        )
    } else {
        (
            false,
            "tls_or_proxy_failure",
            "TCP works but the HTTPS request failed: TLS interception (antivirus/corporate \
             proxy) or a broken proxy setting is the usual cause. Check the hint below."
                .to_string(),
        )
    };

    let token_present = state.config.env_token.is_some() || state.runtime_token.read().await.is_some();

    HttpResponse::Ok().json(json!({
        "ok": ok,
        "verdict": verdict,
        "message": message,
        "api_base": api_base,
        "host": host,
        "port": port,
        "proxy": {
            "mode": state.config.proxy.label(),
            "description": state.config.proxy.description(),
            "env_vars": state.config.proxy_env_vars.clone(),
        },
        "dns": {
            "ok": probe.dns_error.is_none(),
            "addresses": probe.addresses,
            "error": probe.dns_error,
        },
        "tcp": probe.tcp,
        "https": https,
        "token_present": token_present,
    }))
}
