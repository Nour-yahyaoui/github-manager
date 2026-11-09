import { lookup } from 'node:dns/promises';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { Plugin } from 'vite';

interface AuditEntry {
  id: number;
  timestamp: string;
  action: string;
  target: string;
  status: string;
  detail: string;
}

interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  used: number;
  reset_epoch: number;
  scopes: string[];
}

function maskToken(token: string): string {
  if (token.length <= 10) return '••••••••';
  return `${token.slice(0, 6)}••••${token.slice(-4)}`;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
}

function sendApiError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  reset_epoch?: number
): void {
  sendJson(res, status, {
    error: {
      code,
      message,
      status,
      ...(reset_epoch !== undefined ? { reset_epoch } : {}),
    },
  });
}


/**
 * Node's fetch only reports "fetch failed"; the real reason (ENOTFOUND, ECONNREFUSED,
 * self-signed certificate, proxy failure...) lives in the `cause` chain. Flatten it.
 */
function describeNodeFetchError(err: any): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let current: any = err;
  let depth = 0;

  while (current && depth < 6) {
    const text = current.code ? `${current.code}: ${current.message}` : String(current.message || current);
    if (text && !seen.has(text)) {
      seen.add(text);
      parts.push(text);
    }
    current = current.cause;
    depth += 1;
  }

  return parts.join(' -> ') || 'unknown network error';
}

function tcpProbe(address: string, port: number): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: address, port });
    let settled = false;

    const finish = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(6000);
    socket.once('connect', () => finish({ ok: true }));
    socket.once('timeout', () => finish({ ok: false, error: 'timeout after 6000ms' }));
    socket.once('error', (err: any) =>
      finish({ ok: false, error: err?.code ? `${err.code}: ${err.message}` : String(err?.message || err) })
    );
  });
}


let cachedSystemCa: string[] | null | undefined;

/**
 * Node ships its own Mozilla root bundle and ignores the OS certificate store, so a
 * machine behind antivirus/corporate TLS inspection sees "unable to verify the first
 * certificate" even though curl works. Load the system bundle so the bridge behaves
 * like the Rust server (which trusts the OS store).
 */
function systemCaCertificates(): string[] | null {
  if (cachedSystemCa !== undefined) return cachedSystemCa;

  const candidates = [
    process.env.NODE_EXTRA_CA_CERTS,
    process.env.SSL_CERT_FILE,
    '/etc/ssl/certs/ca-certificates.crt',
    '/etc/pki/tls/certs/ca-bundle.crt',
    '/etc/ssl/cert.pem',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const content = fs.readFileSync(candidate, 'utf8');
      if (content.includes('BEGIN CERTIFICATE')) {
        cachedSystemCa = [content];
        return cachedSystemCa;
      }
    } catch {
      // Ignore unreadable paths and keep looking.
    }
  }

  cachedSystemCa = null;
  return cachedSystemCa;
}

interface SimpleHttpResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
}

function httpsRequestWithSystemCa(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<SimpleHttpResponse> {
  const target = new URL(url);
  const ca = systemCaCertificates();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        ...(ca ? { ca } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const flat: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            flat[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
          }
          resolve({ status: res.statusCode || 0, headers: flat, text: Buffer.concat(chunks).toString('utf8') });
        });
      }
    );

    req.setTimeout(30000, () => req.destroy(new Error('timeout after 30000ms')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export function createGitHubBridgePlugin(): Plugin {
  const actixBase = process.env.ACTIX_URL || 'http://127.0.0.1:8080';
  const ghApiBase = (process.env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/+$/, '');
  const envTokenRaw = (process.env.GITHUB_PAT || process.env.GH_PAT || '').trim();
  const envToken =
    envTokenRaw && envTokenRaw !== 'arena-egress-dummy-token' ? envTokenRaw : undefined;

  let runtimeToken: string | undefined;
  let latestRateLimit: RateLimitSnapshot | null = null;
  let auditSeq = 1;
  const auditLog: AuditEntry[] = [];

  function recordAudit(action: string, target: string, status: string, detail: string) {
    auditLog.unshift({
      id: auditSeq++,
      timestamp: new Date().toISOString(),
      action,
      target,
      status,
      detail,
    });
    if (auditLog.length > 250) auditLog.pop();
  }

  function resolveOptionalToken(req: IncomingMessage): { token: string; source: string } | null {
    const hdr = req.headers['x-github-token'];
    const hdrVal = Array.isArray(hdr) ? hdr[0] : hdr;
    if (hdrVal && hdrVal.trim()) {
      return { token: hdrVal.trim(), source: 'request_header' };
    }
    if (runtimeToken) {
      return { token: runtimeToken, source: 'runtime_session' };
    }
    if (envToken) {
      return { token: envToken, source: 'env_file' };
    }
    return null;
  }

  async function tryForwardToActix(req: IncomingMessage, res: ServerResponse, rawBody: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600);
      const headers: Record<string, string> = {};
      if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);
      if (req.headers['x-github-token']) headers['x-github-token'] = String(req.headers['x-github-token']);
      if (req.headers['accept']) headers['accept'] = String(req.headers['accept']);

      const upstream = await fetch(`${actixBase}${req.url}`, {
        method: req.method || 'GET',
        headers,
        body: req.method && !['GET', 'HEAD'].includes(req.method) && rawBody ? rawBody : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const text = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') || 'application/json; charset=utf-8'
      );
      res.end(text);
      return true;
    } catch {
      return false;
    }
  }

  async function ghRequest(
    token: string,
    method: string,
    path: string,
    query?: Record<string, string>,
    body?: unknown
  ): Promise<{ ok: boolean; status: number; data: any; rate: RateLimitSnapshot | null }> {
    const url = new URL(`${ghApiBase}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      }
    }

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'github-manager-bridge/0.1.0',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    };
    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    let status = 0;
    let responseHeaders: Record<string, string> = {};
    let rawText = '';

    try {
      const resp = await fetch(url.toString(), { method, headers: requestHeaders, body: payload });
      status = resp.status;
      resp.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });
      rawText = await resp.text();
    } catch (err: any) {
      const detail = describeNodeFetchError(err);
      const certificateProblem = /CERT|certificate|verify|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(detail);
      if (!certificateProblem || !systemCaCertificates()) throw err;

      // Node rejected a certificate the OS trusts (TLS inspection). Retry with the
      // system bundle instead of failing every GitHub call in the workspace.
      const retried = await httpsRequestWithSystemCa(url.toString(), method, requestHeaders, payload);
      status = retried.status;
      responseHeaders = retried.headers;
      rawText = retried.text;
    }

    const ok = status >= 200 && status < 300;
    const limit = Number(responseHeaders['x-ratelimit-limit'] || 0);
    const remaining = Number(responseHeaders['x-ratelimit-remaining'] || 0);
    const used = Number(responseHeaders['x-ratelimit-used'] || 0);
    const reset_epoch = Number(responseHeaders['x-ratelimit-reset'] || 0);
    const scopesRaw = responseHeaders['x-oauth-scopes'] || '';
    const scopes = scopesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let rate: RateLimitSnapshot | null = null;
    if (limit > 0) {
      rate = { limit, remaining, used, reset_epoch, scopes };
      latestRateLimit = rate;
    }

    let parsed: any = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { message: rawText };
      }
    }

    return { ok, status, data: parsed, rate };
  }

  function respondUpstreamError(
    res: ServerResponse,
    status: number,
    data: any,
    rate: RateLimitSnapshot | null
  ) {
    const baseMsg = data?.message || `GitHub API responded with HTTP ${status}`;
    const errList = Array.isArray(data?.errors)
      ? data.errors
          .map((e: any) => e.message || (e.field && e.code ? `${e.field}: ${e.code}` : ''))
          .filter(Boolean)
          .join('; ')
      : '';
    const fullMsg = errList ? `${baseMsg} (${errList})` : baseMsg;

    if (status === 401) return sendApiError(res, 401, 'UNAUTHORIZED', `GitHub rejected the token: ${fullMsg}`);
    if (status === 403 && rate && rate.remaining === 0) {
      return sendApiError(res, 429, 'RATE_LIMITED', `GitHub API rate limit exhausted: ${fullMsg}`, rate.reset_epoch);
    }
    if (status === 403) return sendApiError(res, 403, 'FORBIDDEN', `Insufficient token permissions: ${fullMsg}`);
    if (status === 404) return sendApiError(res, 404, 'NOT_FOUND', `Resource not found on GitHub: ${fullMsg}`);
    if (status === 422) return sendApiError(res, 422, 'UNPROCESSABLE_ENTITY', fullMsg);
    return sendApiError(res, status, 'GITHUB_UPSTREAM_ERROR', fullMsg);
  }


  async function probeConnectivity(res: ServerResponse): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(ghApiBase);
    } catch (err: any) {
      return sendJson(res, 200, {
        ok: false,
        verdict: 'invalid_api_base',
        message: `GITHUB_API_BASE is not a valid URL: ${err?.message || err}`,
        api_base: ghApiBase,
        proxy: { mode: 'n/a', env_vars: [] },
        dns: { ok: false, addresses: [] as string[], error: null },
        tcp: [] as unknown[],
        https: { ok: false, error: null },
      });
    }

    const host = parsed.hostname;
    const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));

    let addresses: string[] = [];
    let dnsError: string | null = null;
    try {
      const entries = await lookup(host, { all: true });
      addresses = entries.map((entry) => entry.address);
    } catch (err: any) {
      dnsError = describeNodeFetchError(err);
    }

    const tcp: Array<Record<string, unknown>> = [];
    if (!dnsError) {
      for (const address of addresses) {
        const started = Date.now();
        const attempt = await tcpProbe(address, port);
        tcp.push(
          attempt.ok
            ? { address: `${address}:${port}`, ok: true, ms: Date.now() - started }
            : { address: `${address}:${port}`, ok: false, error: attempt.error }
        );
      }
    }

    const zenUrl = `${ghApiBase}/zen`;
    const started = Date.now();
    const probeHeaders = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'github-manager-bridge/0.1.0',
    };
    let https: Record<string, unknown>;
    try {
      const resp = await fetch(zenUrl, { headers: probeHeaders });
      https = { ok: resp.ok, status: resp.status, ms: Date.now() - started, url: zenUrl, via_system_ca: false };
    } catch (err: any) {
      const detail = describeNodeFetchError(err);
      const certificateProblem = /CERT|certificate|verify|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(detail);

      if (certificateProblem && systemCaCertificates()) {
        // Same retry the real GitHub calls use: Node's bundled roots rejected the
        // certificate, but the OS store may trust it (antivirus/proxy inspection).
        try {
          const retried = await httpsRequestWithSystemCa(zenUrl, 'GET', probeHeaders);
          https = {
            ok: retried.status >= 200 && retried.status < 300,
            status: retried.status,
            ms: Date.now() - started,
            url: zenUrl,
            via_system_ca: true,
          };
        } catch (retryErr: any) {
          https = {
            ok: false,
            url: zenUrl,
            error: describeNodeFetchError(retryErr),
            hint: 'TLS certificate is not trusted even with the OS certificate store - check the proxy/antivirus interception.',
          };
        }
      } else {
        let hint: string | null = null;
        if (/ENOTFOUND|EAI_AGAIN/i.test(detail)) {
          hint = 'DNS lookup failed. Check DNS servers, VPN or hosts file entries for api.github.com.';
        } else if (certificateProblem) {
          hint = 'TLS certificate could not be verified - antivirus, corporate proxy or VPN TLS interception.';
        } else if (/ECONNREFUSED/i.test(detail)) {
          hint = 'Connection refused - a local proxy or VPN is redirecting api.github.com.';
        } else if (/ETIMEDOUT|timeout/i.test(detail)) {
          hint = 'Connection timed out - a firewall or VPN is dropping outbound HTTPS.';
        }
        https = { ok: false, url: zenUrl, error: detail, hint };
      }
    }

    const httpsOk = https.ok === true;
    const anyTcpOk = tcp.some((entry) => entry.ok === true);
    const verdict = httpsOk
      ? 'reachable'
      : dnsError
        ? 'dns_failure'
        : !anyTcpOk
          ? 'tcp_blocked'
          : 'tls_or_proxy_failure';

    return sendJson(res, 200, {
      ok: httpsOk,
      verdict,
      message: httpsOk
        ? 'The bridge can reach the GitHub API from this machine.'
        : dnsError
          ? `DNS lookup failed for ${host}.`
          : !anyTcpOk
            ? 'Host resolves but no TCP connection to the API port succeeded.'
            : 'TCP works but the HTTPS call failed (TLS interception or proxy).',
      api_base: ghApiBase,
      host,
      port,
      proxy: {
        mode: 'bridge',
        env_vars: ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'].filter(
          (name) => Boolean(process.env[name] && String(process.env[name]).trim())
        ),
      },
      dns: { ok: !dnsError, addresses, error: dnsError },
      tcp,
      https,
      token_present: Boolean(runtimeToken || envToken),
    });
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url || !req.url.startsWith('/api/v1')) {
      return next();
    }

    const rawBody = await readBody(req);

    // 1. Always prefer the real local Actix Web server when it is running on :8080
    const forwarded = await tryForwardToActix(req, res, rawBody);
    if (forwarded) return;

    // 2. Fallback bridge to https://api.github.com when Actix Web isn't running
    const parsedUrl = new URL(req.url, 'http://localhost');
    const route = parsedUrl.pathname.replace(/^\/api\/v1/, '') || '/';
    const method = (req.method || 'GET').toUpperCase();
    const jsonBody = rawBody ? (() => { try { return JSON.parse(rawBody); } catch { return {}; } })() : {};

    try {
      if (method === 'GET' && route === '/diagnostics/connectivity') {
        return probeConnectivity(res);
      }

      if (method === 'GET' && route === '/health') {
        return sendJson(res, 200, {
          status: 'ok',
          server: 'vite-dev-bridge',
          version: '0.1.0',
          github_api_base: ghApiBase,
          env_token_present: Boolean(envToken),
          session_token_present: Boolean(runtimeToken),
          rate_limit: latestRateLimit,
        });
      }

      if (method === 'GET' && route === '/audit') {
        return sendJson(res, 200, auditLog);
      }
      if (method === 'DELETE' && route === '/audit') {
        auditLog.length = 0;
        return sendJson(res, 200, { cleared: true });
      }

      if (method === 'GET' && route === '/auth/status') {
        const resolved = resolveOptionalToken(req);
        if (!resolved) {
          return sendJson(res, 200, {
            authenticated: false,
            token_source: 'none',
            masked_token: null,
            user: null,
            rate_limit: null,
            scopes: [],
            api_base: ghApiBase,
          });
        }
        const check = await ghRequest(resolved.token, 'GET', '/user');
        if (!check.ok) return respondUpstreamError(res, check.status, check.data, check.rate);
        return sendJson(res, 200, {
          authenticated: true,
          token_source: resolved.source,
          masked_token: maskToken(resolved.token),
          user: check.data,
          rate_limit: check.rate,
          scopes: check.rate?.scopes || [],
          api_base: ghApiBase,
        });
      }

      if (method === 'POST' && route === '/auth/token') {
        const candidate = String(jsonBody?.token || '').trim();
        if (!candidate) return sendApiError(res, 400, 'BAD_REQUEST', 'Personal Access Token cannot be empty.');
        const check = await ghRequest(candidate, 'GET', '/user');
        if (!check.ok) return respondUpstreamError(res, check.status, check.data, check.rate);
        runtimeToken = candidate;
        recordAudit('auth.connect_token', `@${check.data.login}`, 'success', `Connected GitHub PAT (${maskToken(candidate)})`);
        return sendJson(res, 200, {
          authenticated: true,
          token_source: 'runtime_session',
          masked_token: maskToken(candidate),
          user: check.data,
          rate_limit: check.rate,
          scopes: check.rate?.scopes || [],
          api_base: ghApiBase,
        });
      }

      if (method === 'DELETE' && route === '/auth/token') {
        runtimeToken = undefined;
        recordAudit('auth.disconnect_token', 'session', 'success', 'Cleared runtime GitHub token');
        return sendJson(res, 200, { cleared: true, env_token_fallback_present: Boolean(envToken) });
      }

      const resolved = resolveOptionalToken(req);
      if (!resolved) {
        return sendApiError(
          res,
          401,
          'UNAUTHORIZED',
          'No GitHub Personal Access Token configured. Set GITHUB_PAT in .env or connect a token in Token & Connection.'
        );
      }
      const token = resolved.token;

      if (method === 'GET' && route === '/orgs') {
        const r = await ghRequest(token, 'GET', '/user/orgs', { per_page: '100' });
        if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
        return sendJson(res, 200, r.data);
      }

      if (method === 'GET' && route === '/repos') {
        const visibility = parsedUrl.searchParams.get('visibility') || 'all';
        const affiliation = parsedUrl.searchParams.get('affiliation') || 'owner,collaborator,organization_member';
        const sort = parsedUrl.searchParams.get('sort') || 'updated';
        const direction = parsedUrl.searchParams.get('direction') || 'desc';
        const all: any[] = [];
        for (let page = 1; page <= 3; page++) {
          const r = await ghRequest(token, 'GET', '/user/repos', {
            visibility,
            affiliation,
            sort,
            direction,
            per_page: '100',
            page: String(page),
          });
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          all.push(...(Array.isArray(r.data) ? r.data : []));
          if (!Array.isArray(r.data) || r.data.length < 100) break;
        }
        return sendJson(res, 200, all);
      }

      if (method === 'POST' && route === '/repos') {
        const payload = { ...jsonBody };
        const org = typeof payload.org === 'string' ? payload.org.trim() : '';
        delete payload.org;
        if (payload.visibility) {
          payload.private = payload.visibility === 'private' || payload.visibility === 'internal';
        }
        const targetPath = org ? `/orgs/${encodeURIComponent(org)}/repos` : '/user/repos';
        const r = await ghRequest(token, 'POST', targetPath, undefined, payload);
        if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
        recordAudit('repo.create', r.data.full_name, 'success', `Created ${r.data.private ? 'private' : 'public'} repository`);
        return sendJson(res, 201, r.data);
      }

      if (method === 'POST' && route === '/bulk/repos') {
        const repos: string[] = Array.isArray(jsonBody.repositories) ? jsonBody.repositories : [];
        const action = jsonBody.action || {};
        if (!repos.length) return sendApiError(res, 400, 'BAD_REQUEST', 'Select at least one repository.');
        if (action.kind === 'delete_repositories' && String(action.confirm_phrase || '').trim() !== 'DELETE SELECTED') {
          return sendApiError(res, 400, 'BAD_REQUEST', "Type 'DELETE SELECTED' exactly to confirm batch deletion.");
        }
        const results: Array<{ full_name: string; ok: boolean; message: string }> = [];
        let succeeded = 0;
        let failed = 0;
        for (const full_name of repos) {
          const [owner, repo] = full_name.split('/');
          if (!owner || !repo) {
            failed++;
            results.push({ full_name, ok: false, message: 'Invalid owner/repo identifier' });
            continue;
          }
          let r: { ok: boolean; status: number; data: any };
          if (action.kind === 'set_visibility') {
            const vis = String(action.visibility || 'private');
            r = await ghRequest(token, 'PATCH', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, undefined, {
              visibility: vis,
              private: vis === 'private',
            });
          } else if (action.kind === 'set_archived') {
            r = await ghRequest(token, 'PATCH', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, undefined, {
              archived: Boolean(action.archived),
            });
          } else if (action.kind === 'update_features') {
            const patch: Record<string, unknown> = {};
            for (const k of ['has_issues', 'has_wiki', 'has_projects', 'delete_branch_on_merge', 'allow_auto_merge']) {
              if (typeof action[k] === 'boolean') patch[k] = action[k];
            }
            r = await ghRequest(token, 'PATCH', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, undefined, patch);
          } else if (action.kind === 'add_topics') {
            const cur = await ghRequest(token, 'GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics`);
            if (!cur.ok) {
              r = cur;
            } else {
              const merged = Array.from(new Set([...(cur.data?.names || []), ...(action.topics || [])]));
              r = await ghRequest(token, 'PUT', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics`, undefined, { names: merged });
            }
          } else if (action.kind === 'replace_topics') {
            r = await ghRequest(token, 'PUT', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics`, undefined, { names: action.topics || [] });
          } else if (action.kind === 'delete_repositories') {
            r = await ghRequest(token, 'DELETE', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
          } else {
            r = { ok: false, status: 400, data: { message: 'Unsupported bulk action' } };
          }

          if (r.ok) {
            succeeded++;
            results.push({ full_name, ok: true, message: 'Applied successfully' });
          } else {
            failed++;
            results.push({ full_name, ok: false, message: r.data?.message || `HTTP ${r.status}` });
          }
        }
        recordAudit('bulk.execute', `${repos.length} repo(s)`, failed === 0 ? 'success' : 'partial', `${succeeded} succeeded, ${failed} failed`);
        return sendJson(res, 200, { total: repos.length, succeeded, failed, results });
      }

      // Match /repos/:owner/:repo...
      const repoMatch = route.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
      if (repoMatch) {
        const owner = decodeURIComponent(repoMatch[1]);
        const repo = decodeURIComponent(repoMatch[2]);
        const sub = repoMatch[3] || '';
        const baseRepoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

        if (!sub) {
          if (method === 'GET') {
            const r = await ghRequest(token, 'GET', baseRepoPath);
            if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
            return sendJson(res, 200, r.data);
          }
          if (method === 'PATCH') {
            const patch = { ...jsonBody };
            if (patch.visibility === 'public' || patch.visibility === 'private') {
              patch.private = patch.visibility === 'private';
            }
            const r = await ghRequest(token, 'PATCH', baseRepoPath, undefined, patch);
            if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
            recordAudit('repo.update', r.data.full_name, 'success', 'Updated repository settings');
            return sendJson(res, 200, r.data);
          }
          if (method === 'DELETE') {
            const r = await ghRequest(token, 'DELETE', baseRepoPath);
            if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
            recordAudit('repo.delete', `${owner}/${repo}`, 'success', 'Permanently deleted repository');
            return sendJson(res, 200, { deleted: true, full_name: `${owner}/${repo}` });
          }
        }

        if (sub === 'topics') {
          if (method === 'GET') {
            const r = await ghRequest(token, 'GET', `${baseRepoPath}/topics`);
            if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
            return sendJson(res, 200, r.data);
          }
          if (method === 'PUT') {
            const names = Array.isArray(jsonBody.names) ? jsonBody.names : [];
            const r = await ghRequest(token, 'PUT', `${baseRepoPath}/topics`, undefined, { names });
            if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
            recordAudit('repo.topics', `${owner}/${repo}`, 'success', `Updated topics (${names.join(', ')})`);
            return sendJson(res, 200, r.data);
          }
        }

        if (sub === 'transfer' && method === 'POST') {
          const r = await ghRequest(token, 'POST', `${baseRepoPath}/transfer`, undefined, jsonBody);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('repo.transfer', `${owner}/${repo}`, 'success', `Initiated transfer to @${jsonBody.new_owner}`);
          return sendJson(res, 202, r.data);
        }

        if (sub === 'branches' && method === 'GET') {
          const r = await ghRequest(token, 'GET', `${baseRepoPath}/branches`, { per_page: '100' });
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          return sendJson(res, 200, r.data);
        }
        if (sub === 'branches' && method === 'POST') {
          const r = await ghRequest(token, 'POST', `${baseRepoPath}/git/refs`, undefined, {
            ref: `refs/heads/${String(jsonBody.branch_name || '').replace(/^refs\/heads\//, '')}`,
            sha: jsonBody.from_sha,
          });
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('branch.create', `${owner}/${repo}`, 'success', `Created branch ${jsonBody.branch_name}`);
          return sendJson(res, 201, r.data);
        }
        if (sub === 'branches/rename' && method === 'POST') {
          const r = await ghRequest(
            token,
            'POST',
            `${baseRepoPath}/branches/${encodeURIComponent(jsonBody.branch)}/rename`,
            undefined,
            { new_name: jsonBody.new_name }
          );
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('branch.rename', `${owner}/${repo}`, 'success', `Renamed ${jsonBody.branch} -> ${jsonBody.new_name}`);
          return sendJson(res, 200, r.data);
        }
        if (sub.startsWith('branches/') && method === 'DELETE') {
          const branch = sub.slice('branches/'.length);
          const encBranch = branch.split('/').map(encodeURIComponent).join('/');
          const r = await ghRequest(token, 'DELETE', `${baseRepoPath}/git/refs/heads/${encBranch}`);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('branch.delete', `${owner}/${repo}`, 'success', `Deleted branch ${branch}`);
          return sendJson(res, 200, { deleted: true, branch });
        }

        if (sub === 'readme' && method === 'GET') {
          const r = await ghRequest(token, 'GET', `${baseRepoPath}/readme`);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          const decoded = Buffer.from(String(r.data.content || '').replace(/\s+/g, ''), 'base64').toString('utf8');
          return sendJson(res, 200, {
            name: r.data.name,
            path: r.data.path,
            sha: r.data.sha,
            size: r.data.size,
            html_url: r.data.html_url,
            decoded_content: decoded,
          });
        }

        if ((sub === 'contents' || sub.startsWith('contents/')) && method === 'GET') {
          const fileSub = sub === 'contents' ? '' : sub.slice('contents/'.length);
          const encSub = fileSub ? '/' + fileSub.split('/').map(encodeURIComponent).join('/') : '';
          const r = await ghRequest(token, 'GET', `${baseRepoPath}/contents${encSub}`);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          return sendJson(res, 200, r.data);
        }

        if (sub.startsWith('contents/') && method === 'PUT') {
          const fileSub = sub.slice('contents/'.length);
          const encSub = fileSub.split('/').map(encodeURIComponent).join('/');
          const payload: Record<string, unknown> = {
            message: jsonBody.message,
            content: Buffer.from(String(jsonBody.content_utf8 || ''), 'utf8').toString('base64'),
          };
          if (jsonBody.sha) payload.sha = jsonBody.sha;
          if (jsonBody.branch) payload.branch = jsonBody.branch;
          const r = await ghRequest(token, 'PUT', `${baseRepoPath}/contents/${encSub}`, undefined, payload);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('content.commit', `${owner}/${repo}`, 'success', `Committed ${fileSub}`);
          return sendJson(res, 200, r.data);
        }

        if (sub === 'issues' && method === 'GET') {
          const r = await ghRequest(token, 'GET', `${baseRepoPath}/issues`, {
            state: parsedUrl.searchParams.get('state') || 'open',
            per_page: '50',
          });
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          return sendJson(res, 200, r.data);
        }
        if (sub === 'issues' && method === 'POST') {
          const r = await ghRequest(token, 'POST', `${baseRepoPath}/issues`, undefined, jsonBody);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('issue.create', `${owner}/${repo}#${r.data.number}`, 'success', `Opened issue: ${r.data.title}`);
          return sendJson(res, 201, r.data);
        }
        const issueMatch = sub.match(/^issues\/(\d+)$/);
        if (issueMatch && method === 'PATCH') {
          const r = await ghRequest(token, 'PATCH', `${baseRepoPath}/issues/${issueMatch[1]}`, undefined, jsonBody);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('issue.update', `${owner}/${repo}#${issueMatch[1]}`, 'success', `State -> ${r.data.state}`);
          return sendJson(res, 200, r.data);
        }

        if (sub === 'releases' && method === 'GET') {
          const r = await ghRequest(token, 'GET', `${baseRepoPath}/releases`, { per_page: '50' });
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          return sendJson(res, 200, r.data);
        }
        if (sub === 'releases' && method === 'POST') {
          const r = await ghRequest(token, 'POST', `${baseRepoPath}/releases`, undefined, jsonBody);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('release.create', `${owner}/${repo}`, 'success', `Created release ${r.data.tag_name}`);
          return sendJson(res, 201, r.data);
        }
        const relMatch = sub.match(/^releases\/(\d+)$/);
        if (relMatch && method === 'DELETE') {
          const r = await ghRequest(token, 'DELETE', `${baseRepoPath}/releases/${relMatch[1]}`);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('release.delete', `${owner}/${repo}`, 'success', `Deleted release #${relMatch[1]}`);
          return sendJson(res, 200, { deleted: true });
        }

        if (sub === 'collaborators' && method === 'GET') {
          const r = await ghRequest(token, 'GET', `${baseRepoPath}/collaborators`, { per_page: '100' });
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          return sendJson(res, 200, r.data);
        }
        const collabMatch = sub.match(/^collaborators\/([^/]+)$/);
        if (collabMatch && method === 'PUT') {
          const user = decodeURIComponent(collabMatch[1]);
          const r = await ghRequest(token, 'PUT', `${baseRepoPath}/collaborators/${encodeURIComponent(user)}`, undefined, jsonBody);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('collaborator.add', `${owner}/${repo}`, 'success', `Invited/updated @${user}`);
          return sendJson(res, 200, r.data || { status: 'ok', username: user });
        }
        if (collabMatch && method === 'DELETE') {
          const user = decodeURIComponent(collabMatch[1]);
          const r = await ghRequest(token, 'DELETE', `${baseRepoPath}/collaborators/${encodeURIComponent(user)}`);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('collaborator.remove', `${owner}/${repo}`, 'success', `Removed @${user}`);
          return sendJson(res, 200, { removed: true });
        }

        if (sub === 'hooks' && method === 'GET') {
          const r = await ghRequest(token, 'GET', `${baseRepoPath}/hooks`);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          return sendJson(res, 200, r.data);
        }
        if (sub === 'hooks' && method === 'POST') {
          const cfg: Record<string, unknown> = {
            url: jsonBody.url,
            content_type: jsonBody.content_type || 'json',
            insecure_ssl: '0',
          };
          if (jsonBody.secret) cfg.secret = jsonBody.secret;
          const r = await ghRequest(token, 'POST', `${baseRepoPath}/hooks`, undefined, {
            name: 'web',
            active: jsonBody.active ?? true,
            events: Array.isArray(jsonBody.events) && jsonBody.events.length ? jsonBody.events : ['push'],
            config: cfg,
          });
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('webhook.create', `${owner}/${repo}`, 'success', `Created webhook #${r.data.id}`);
          return sendJson(res, 201, r.data);
        }
        const hookPingMatch = sub.match(/^hooks\/(\d+)\/pings$/);
        if (hookPingMatch && method === 'POST') {
          const r = await ghRequest(token, 'POST', `${baseRepoPath}/hooks/${hookPingMatch[1]}/pings`);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('webhook.ping', `${owner}/${repo}`, 'success', `Pinged webhook #${hookPingMatch[1]}`);
          return sendJson(res, 200, { pinged: true });
        }
        const hookMatch = sub.match(/^hooks\/(\d+)$/);
        if (hookMatch && method === 'PATCH') {
          const patch: Record<string, unknown> = {};
          if (typeof jsonBody.active === 'boolean') patch.active = jsonBody.active;
          if (Array.isArray(jsonBody.events)) patch.events = jsonBody.events;
          const r = await ghRequest(token, 'PATCH', `${baseRepoPath}/hooks/${hookMatch[1]}`, undefined, patch);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('webhook.update', `${owner}/${repo}`, 'success', `Updated webhook #${hookMatch[1]}`);
          return sendJson(res, 200, r.data);
        }
        if (hookMatch && method === 'DELETE') {
          const r = await ghRequest(token, 'DELETE', `${baseRepoPath}/hooks/${hookMatch[1]}`);
          if (!r.ok) return respondUpstreamError(res, r.status, r.data, r.rate);
          recordAudit('webhook.delete', `${owner}/${repo}`, 'success', `Deleted webhook #${hookMatch[1]}`);
          return sendJson(res, 200, { deleted: true });
        }
      }

      return sendApiError(res, 404, 'API_ROUTE_NOT_FOUND', `Unknown API endpoint: ${method} ${route}`);
    } catch (err: any) {
      return sendApiError(res, 500, 'INTERNAL_ERROR', describeNodeFetchError(err));
    }
  };

  return {
    name: 'github-manager-actix-or-direct-bridge',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
