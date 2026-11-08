import React, { useEffect, useId, useState } from 'react';
import { AlertTriangle, ExternalLink, Plus, Settings2, X } from 'lucide-react';
import type { Repository } from '../../api/types';
import { useApp } from '../../context/AppContext';

interface QuickEditDrawerProps {
  repo: Repository | null;
  onClose: () => void;
}

export const QuickEditDrawer: React.FC<QuickEditDrawerProps> = ({ repo, onClose }) => {
  const { api, upsertRepoInList, refreshAudit, navigateTo, pushToast } = useApp();
  const titleId = useId();

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [homepage, setHomepage] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicDraft, setTopicDraft] = useState('');
  const [archived, setArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repo) return;
    setName(repo.name);
    setVisibility(repo.private ? 'private' : 'public');
    setDescription(repo.description || '');
    setHomepage(repo.homepage || '');
    setTopics(repo.topics || []);
    setTopicDraft('');
    setArchived(repo.archived);
    setError(null);
  }, [repo]);

  useEffect(() => {
    if (!repo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [repo, saving, onClose]);

  if (!repo) return null;

  const addTopic = () => {
    const cleaned = topicDraft
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
      .filter(Boolean);
    if (!cleaned.length) return;
    setTopics((prev) => Array.from(new Set([...prev, ...cleaned])));
    setTopicDraft('');
  };

  const removeTopic = (t: string) => {
    setTopics((prev) => prev.filter((x) => x !== t));
  };

  const visibilityChanged = (repo.private ? 'private' : 'public') !== visibility;
  const nameChanged = name.trim() !== repo.name;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Repository name cannot be empty.');
      return;
    }

    setSaving(true);
    setError(null);
    const prevFullName = repo.full_name;
    try {
      let updated = await api.updateRepo(repo.owner.login, repo.name, {
        name: cleanName,
        visibility,
        private: visibility === 'private',
        description,
        homepage,
        archived,
      });

      const prevTopicsKey = [...(repo.topics || [])].sort().join(',');
      const nextTopicsKey = [...topics].sort().join(',');
      if (prevTopicsKey !== nextTopicsKey) {
        const savedTopics = await api.replaceTopics(updated.owner.login, updated.name, topics);
        updated = { ...updated, topics: savedTopics };
      }

      upsertRepoInList(updated, prevFullName);
      void refreshAudit();
      pushToast('success', `Saved changes to ${updated.full_name}`);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update repository.';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="panel-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 5 }}>
          <div>
            <h2 id={titleId}>Quick Edit · {repo.name}</h2>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {repo.full_name}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost icon-btn"
            aria-label="Close quick edit drawer"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          {error && (
            <div className="alert-box alert-error" role="alert">
              <AlertTriangle size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="qe-repo-name" className="field-label">
              Repository Name
            </label>
            <input
              id="qe-repo-name"
              type="text"
              className="input mono"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            {nameChanged && (
              <p className="field-hint">
                New slug preview: <code>{repo.owner.login}/{name.trim() || '…'}</code> (GitHub automatically redirects web &amp; git traffic).
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="qe-visibility" className="field-label">
              Visibility
            </label>
            <select
              id="qe-visibility"
              className="select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
            >
              <option value="public">Public — visible to anyone</option>
              <option value="private">Private — accessible only to you and collaborators</option>
            </select>
            {visibilityChanged && (
              <div className="alert-box alert-error" style={{ marginTop: 4 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <span>
                  Changing visibility to <strong>{visibility}</strong> takes effect immediately upon saving.
                </span>
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="qe-description" className="field-label">
              Description
            </label>
            <textarea
              id="qe-description"
              className="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short, factual summary of what this repository does…"
            />
          </div>

          <div className="field">
            <label htmlFor="qe-homepage" className="field-label">
              Homepage / Documentation URL
            </label>
            <input
              id="qe-homepage"
              type="text"
              className="input"
              value={homepage}
              onChange={(e) => setHomepage(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="field">
            <label htmlFor="qe-topic-input" className="field-label">
              Topics
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="qe-topic-input"
                type="text"
                className="input mono"
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="rust, actix-web, cli"
              />
              <button type="button" className="btn" onClick={addTopic}>
                <Plus size={14} aria-hidden="true" />
                Add
              </button>
            </div>
            {topics.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {topics.map((t) => (
                  <span key={t} className="topic-chip">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove topic ${t}`}
                      onClick={() => removeTopic(t)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontWeight: 700,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-sunken)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            <span>
              <strong>Archived (read-only)</strong> — mark repository as inactive on GitHub
            </span>
          </label>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 16,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  const target = repo;
                  onClose();
                  navigateTo('repo-detail', { owner: target.owner.login, repo: target.name });
                }}
              >
                <Settings2 size={13} aria-hidden="true" />
                Full Workspace
              </button>
              {repo.html_url && (
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                >
                  <ExternalLink size={13} aria-hidden="true" />
                  GitHub
                </a>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" disabled={saving} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
