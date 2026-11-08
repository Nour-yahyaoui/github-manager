import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Radio, Trash2, UserPlus, Users, Webhook } from 'lucide-react';
import type { Collaborator, Repository, WebhookItem } from '../../../api/types';
import { useApp } from '../../../context/AppContext';

interface Props {
  repo: Repository;
}

export const AccessHooksTab: React.FC<Props> = ({ repo }) => {
  const { api, refreshAudit, pushToast } = useApp();

  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [hooks, setHooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState('');
  const [permission, setPermission] = useState('push');
  const [addingUser, setAddingUser] = useState(false);

  const [hookUrl, setHookUrl] = useState('');
  const [hookSecret, setHookSecret] = useState('');
  const [hookEvents, setHookEvents] = useState('push, pull_request');
  const [addingHook, setAddingHook] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, h] = await Promise.all([
        api.listCollaborators(repo.owner.login, repo.name).catch(() => [] as Collaborator[]),
        api.listWebhooks(repo.owner.login, repo.name).catch(() => [] as WebhookItem[]),
      ]);
      setCollabs(c);
      setHooks(h);
    } finally {
      setLoading(false);
    }
  }, [api, repo.owner.login, repo.name]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setAddingUser(true);
    try {
      await api.addCollaborator(repo.owner.login, repo.name, username.trim(), permission);
      setUsername('');
      await Promise.all([loadAll(), refreshAudit()]);
      pushToast('success', `Invited/updated @${username.trim()}`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to add collaborator.');
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (login: string) => {
    try {
      await api.removeCollaborator(repo.owner.login, repo.name, login);
      await Promise.all([loadAll(), refreshAudit()]);
      pushToast('success', `Removed @${login}`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to remove collaborator.');
    }
  };

  const handleCreateHook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hookUrl.trim()) return;
    setAddingHook(true);
    try {
      const events = hookEvents
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.createWebhook(repo.owner.login, repo.name, {
        url: hookUrl.trim(),
        secret: hookSecret.trim() || undefined,
        events: events.length ? events : ['push'],
        active: true,
      });
      setHookUrl('');
      setHookSecret('');
      await Promise.all([loadAll(), refreshAudit()]);
      pushToast('success', 'Registered repository webhook.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to register webhook.');
    } finally {
      setAddingHook(false);
    }
  };

  const handleToggleHook = async (hook: WebhookItem) => {
    try {
      await api.toggleWebhook(repo.owner.login, repo.name, hook.id, !hook.active);
      await Promise.all([loadAll(), refreshAudit()]);
      pushToast('info', `Webhook #${hook.id} ${!hook.active ? 'enabled' : 'paused'}.`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to update webhook.');
    }
  };

  const handlePingHook = async (hookId: number) => {
    try {
      await api.pingWebhook(repo.owner.login, repo.name, hookId);
      void refreshAudit();
      pushToast('success', `Sent test ping to webhook #${hookId}.`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to ping webhook.');
    }
  };

  const handleDeleteHook = async (hookId: number) => {
    try {
      await api.deleteWebhook(repo.owner.login, repo.name, hookId);
      await Promise.all([loadAll(), refreshAudit()]);
      pushToast('success', `Deleted webhook #${hookId}.`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to delete webhook.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Collaborators */}
      <section className="panel" aria-labelledby="collab-heading">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} aria-hidden="true" />
            <h3 id="collab-heading">Collaborators ({collabs.length})</h3>
          </div>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!repo.archived && (
            <form
              onSubmit={(e) => void handleInvite(e)}
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label htmlFor="collab-user" className="field-label">
                  GitHub Username
                </label>
                <input
                  id="collab-user"
                  type="text"
                  className="input mono"
                  placeholder="octocat"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="field" style={{ flex: '0 0 170px' }}>
                <label htmlFor="collab-perm" className="field-label">
                  Role
                </label>
                <select
                  id="collab-perm"
                  className="select"
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                >
                  <option value="pull">Read (pull)</option>
                  <option value="triage">Triage</option>
                  <option value="push">Write (push)</option>
                  <option value="maintain">Maintain</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={addingUser}>
                <UserPlus size={14} aria-hidden="true" />
                {addingUser ? 'Inviting…' : 'Invite / Update'}
              </button>
            </form>
          )}

          {loading ? (
            <div>Loading collaborators…</div>
          ) : collabs.length === 0 ? (
            <span className="field-hint">
              No collaborator entries returned (requires push/admin token scope).
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {collabs.map((c) => (
                <div
                  key={c.login}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-sunken)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong className="mono">@{c.login}</strong>
                    <span className="badge">{c.role_name || (c.permissions?.admin ? 'admin' : 'push')}</span>
                  </div>
                  {c.login !== repo.owner.login && !repo.archived && (
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm icon-btn"
                      aria-label={`Remove @${c.login}`}
                      onClick={() => void handleRemoveUser(c.login)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Webhooks */}
      <section className="panel" aria-labelledby="hooks-heading">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Webhook size={16} aria-hidden="true" />
            <h3 id="hooks-heading">Webhooks ({hooks.length})</h3>
          </div>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!repo.archived && (
            <form
              onSubmit={(e) => void handleCreateHook(e)}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="wh-url" className="field-label">
                    Payload URL
                  </label>
                  <input
                    id="wh-url"
                    type="url"
                    className="input mono"
                    placeholder="https://ci.example.com/github/webhook"
                    value={hookUrl}
                    onChange={(e) => setHookUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="wh-events" className="field-label">
                    Events (comma-separated)
                  </label>
                  <input
                    id="wh-events"
                    type="text"
                    className="input mono"
                    value={hookEvents}
                    onChange={(e) => setHookEvents(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 240px' }}>
                  <label htmlFor="wh-secret" className="field-label">
                    HMAC Secret (optional)
                  </label>
                  <input
                    id="wh-secret"
                    type="password"
                    className="input mono"
                    placeholder="Optional X-Hub-Signature-256 secret"
                    value={hookSecret}
                    onChange={(e) => setHookSecret(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={addingHook}>
                  <Plus size={14} aria-hidden="true" />
                  {addingHook ? 'Adding…' : 'Register Webhook'}
                </button>
              </div>
            </form>
          )}

          {hooks.length === 0 ? (
            <span className="field-hint">No webhooks configured on this repository.</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hooks.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>
                      {h.config?.url || `Webhook #${h.id}`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Events: {h.events.join(', ')} · {h.active ? 'Active' : 'Paused'}
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void handlePingHook(h.id)}
                    >
                      <Radio size={12} aria-hidden="true" />
                      Ping
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void handleToggleHook(h)}
                    >
                      {h.active ? 'Pause' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm icon-btn"
                      aria-label={`Delete webhook ${h.id}`}
                      onClick={() => void handleDeleteHook(h.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
