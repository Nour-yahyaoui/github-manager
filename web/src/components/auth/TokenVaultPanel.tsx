import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  LogOut,
  Server,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TokenVaultPanel: React.FC = () => {
  const {
    auth,
    health,
    isDemo,
    enterDemoWorkspace,
    connectPat,
    disconnectPat,
    pushToast,
  } = useApp();

  const [tokenInput, setTokenInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setError('Enter a GitHub Personal Access Token (ghp_… or github_pat_…).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await connectPat(trimmed);
      setTokenInput('');
    } catch (err: any) {
      const msg = err?.message || 'Unable to verify Personal Access Token with GitHub.';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetFormatted = auth?.rate_limit?.reset_epoch
    ? new Date(auth.rate_limit.reset_epoch * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>
      {auth?.authenticated && !isDemo && (
        <section className="panel" aria-labelledby="active-session-heading">
          <div className="panel-header">
            <h2 id="active-session-heading">Active GitHub Connection</h2>
            {auth.token_source === 'runtime_session' && (
              <button
                type="button"
                className="btn btn-danger-outline btn-sm"
                onClick={() => void disconnectPat()}
              >
                <LogOut size={13} aria-hidden="true" />
                Disconnect Session Token
              </button>
            )}
          </div>
          <div className="panel-body">
            <div className="grid-2">
              <div className="field">
                <span className="field-label">Authenticated Account</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2
                    size={16}
                    style={{ color: 'var(--success-text)' }}
                    aria-hidden="true"
                  />
                  <strong>@{auth.user?.login}</strong>
                  {auth.user?.name && (
                    <span style={{ color: 'var(--text-secondary)' }}>({auth.user.name})</span>
                  )}
                </div>
              </div>

              <div className="field">
                <span className="field-label">Token Source & Mask</span>
                <div className="mono" style={{ fontSize: 13 }}>
                  {auth.token_source} · {auth.masked_token || '••••••••'}
                </div>
              </div>

              <div className="field">
                <span className="field-label">REST API Quota</span>
                <div className="mono tabular" style={{ fontSize: 13 }}>
                  {auth.rate_limit
                    ? `${auth.rate_limit.remaining} / ${auth.rate_limit.limit} remaining${resetFormatted ? ` (resets ${resetFormatted})` : ''}`
                    : 'Quota headers pending'}
                </div>
              </div>

              <div className="field">
                <span className="field-label">Detected OAuth Scopes</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {auth.scopes.length > 0 ? (
                    auth.scopes.map((sc) => (
                      <span key={sc} className="topic-chip">
                        {sc}
                      </span>
                    ))
                  ) : (
                    <span className="field-hint">
                      Fine-grained PAT (permissions scoped per repository; GitHub omits X-OAuth-Scopes)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="connect-pat-heading">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <KeyRound size={17} aria-hidden="true" />
            <h2 id="connect-pat-heading">
              {auth?.authenticated && !isDemo
                ? 'Switch or Update Personal Access Token'
                : 'Connect GitHub Personal Access Token'}
            </h2>
          </div>
          {!isDemo && !auth?.authenticated && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void enterDemoWorkspace()}
            >
              <FlaskConical size={13} aria-hidden="true" />
              Explore Sample Workspace (Demo Data)
            </button>
          )}
        </div>

        <div className="panel-body">
          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="field-hint" style={{ fontSize: 13 }}>
              Your Personal Access Token is held only in local server memory (or loaded from your local{' '}
              <code>.env</code> file via <code>GITHUB_PAT</code>) and transmitted solely to{' '}
              <code>{auth?.api_base || 'https://api.github.com'}</code>.
            </p>

            {error && (
              <div className="alert-box alert-error" role="alert">
                <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="pat-secret-input" className="field-label">
                Personal Access Token
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="pat-secret-input"
                  type={reveal ? 'text' : 'password'}
                  className="input mono"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx or github_pat_xxxxxxxxxxxx"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn icon-btn"
                  aria-label={reveal ? 'Hide token characters' : 'Show token characters'}
                  onClick={() => setReveal((r) => !r)}
                >
                  {reveal ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Verifying with GitHub…' : 'Verify & Connect Token'}
              </button>
              {!isDemo && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void enterDemoWorkspace()}
                >
                  <FlaskConical size={14} aria-hidden="true" />
                  Try Sample Workspace (Demo Data)
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className="panel" aria-labelledby="scopes-guide-heading">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Server size={16} aria-hidden="true" />
            <h2 id="scopes-guide-heading">Recommended Token Permissions & Local Runtime</h2>
          </div>
        </div>
        <div className="panel-body">
          <div className="grid-2">
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 13.5 }}>Classic PAT (ghp_…)</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13 }}>
                <li>
                  <code>repo</code> — Read/write public &amp; private repo metadata, branches, contents, issues, releases
                </li>
                <li>
                  <code>delete_repo</code> — Required only for permanent repository deletion
                </li>
                <li>
                  <code>admin:repo_hook</code> — Manage repository webhooks
                </li>
                <li>
                  <code>read:org</code> — List organizations when creating org repositories
                </li>
              </ul>
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 13.5 }}>Fine-Grained PAT (github_pat_…)</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13 }}>
                <li>
                  <strong>Administration:</strong> Read &amp; write (rename, visibility, settings, create/delete)
                </li>
                <li>
                  <strong>Contents:</strong> Read &amp; write (branches, README editor, releases)
                </li>
                <li>
                  <strong>Issues &amp; Pull requests:</strong> Read &amp; write
                </li>
                <li>
                  <strong>Webhooks:</strong> Read &amp; write
                </li>
              </ul>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span>
              Backend transport:{' '}
              <code className="mono">{health?.server || 'connecting…'}</code>
            </span>
            <span>
              Local persistent setup: set <code>GITHUB_PAT=…</code> in <code>.env</code> and run{' '}
              <code>cargo run</code>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
