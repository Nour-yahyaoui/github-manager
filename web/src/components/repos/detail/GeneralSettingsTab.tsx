import React, { useEffect, useState } from 'react';
import { Check, Copy, Plus, Save } from 'lucide-react';
import type { BranchSummary, Repository } from '../../../api/types';
import { useApp } from '../../../context/AppContext';
import { ConfirmDangerModal } from '../../ui/ConfirmDangerModal';

interface Props {
  repo: Repository;
  branches: BranchSummary[];
  onUpdated: (updated: Repository, prevFullName?: string) => void;
}

export const GeneralSettingsTab: React.FC<Props> = ({ repo, branches, onUpdated }) => {
  const { api, refreshAudit, pushToast } = useApp();

  const [name, setName] = useState(repo.name);
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    repo.private ? 'private' : 'public'
  );
  const [description, setDescription] = useState(repo.description || '');
  const [homepage, setHomepage] = useState(repo.homepage || '');
  const [defaultBranch, setDefaultBranch] = useState(repo.default_branch);
  const [isTemplate, setIsTemplate] = useState(repo.is_template);
  const [topics, setTopics] = useState<string[]>(repo.topics || []);
  const [topicDraft, setTopicDraft] = useState('');

  const [saving, setSaving] = useState(false);
  const [confirmVisOpen, setConfirmVisOpen] = useState(false);
  const [copiedClone, setCopiedClone] = useState(false);

  useEffect(() => {
    setName(repo.name);
    setVisibility(repo.private ? 'private' : 'public');
    setDescription(repo.description || '');
    setHomepage(repo.homepage || '');
    setDefaultBranch(repo.default_branch);
    setIsTemplate(repo.is_template);
    setTopics(repo.topics || []);
  }, [repo]);

  const addTopic = () => {
    const list = topicDraft
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
      .filter(Boolean);
    if (!list.length) return;
    setTopics((prev) => Array.from(new Set([...prev, ...list])));
    setTopicDraft('');
  };

  const performSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      pushToast('error', 'Repository name is required.');
      return;
    }
    setSaving(true);
    const prevFull = repo.full_name;
    try {
      let updated = await api.updateRepo(repo.owner.login, repo.name, {
        name: cleanName,
        visibility,
        private: visibility === 'private',
        description,
        homepage,
        default_branch: defaultBranch || repo.default_branch,
        is_template: isTemplate,
      });

      const oldTopics = [...(repo.topics || [])].sort().join(',');
      const newTopics = [...topics].sort().join(',');
      if (oldTopics !== newTopics) {
        const savedTopics = await api.replaceTopics(updated.owner.login, updated.name, topics);
        updated = { ...updated, topics: savedTopics };
      }

      onUpdated(updated, prevFull);
      void refreshAudit();
      pushToast('success', `Updated general settings for ${updated.full_name}`);
      setConfirmVisOpen(false);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save repository settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const curVis = repo.private ? 'private' : 'public';
    if (curVis !== visibility) {
      setConfirmVisOpen(true);
      return;
    }
    void performSave();
  };

  const cloneUrl = repo.clone_url || `https://github.com/${repo.full_name}.git`;

  const copyCloneUrl = async () => {
    try {
      await navigator.clipboard.writeText(cloneUrl);
      setCopiedClone(true);
      setTimeout(() => setCopiedClone(false), 1800);
    } catch {
      pushToast('info', cloneUrl);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section className="panel" aria-labelledby="gen-identity-heading">
        <div className="panel-header">
          <h3 id="gen-identity-heading">Identity, Visibility &amp; Metadata</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {cloneUrl}
            </code>
            <button
              type="button"
              className="btn btn-sm"
              aria-label="Copy HTTPS clone URL"
              onClick={() => void copyCloneUrl()}
            >
              {copiedClone ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copiedClone ? 'Copied' : 'Clone URL'}
            </button>
          </div>
        </div>

        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="gen-name" className="field-label">
                Repository Name
              </label>
              <input
                id="gen-name"
                type="text"
                className="input mono"
                value={name}
                disabled={repo.archived}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="gen-visibility" className="field-label">
                Visibility
              </label>
              <select
                id="gen-visibility"
                className="select"
                value={visibility}
                disabled={repo.archived}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="gen-description" className="field-label">
              Description
            </label>
            <textarea
              id="gen-description"
              className="textarea"
              rows={3}
              disabled={repo.archived}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Repository summary displayed on GitHub…"
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="gen-homepage" className="field-label">
                Homepage / Docs URL
              </label>
              <input
                id="gen-homepage"
                type="text"
                className="input"
                disabled={repo.archived}
                value={homepage}
                onChange={(e) => setHomepage(e.target.value)}
                placeholder="https://example.org"
              />
            </div>

            <div className="field">
              <label htmlFor="gen-default-branch" className="field-label">
                Default Branch
              </label>
              <select
                id="gen-default-branch"
                className="select mono"
                disabled={repo.archived}
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
              >
                {branches.length === 0 ? (
                  <option value={repo.default_branch}>{repo.default_branch}</option>
                ) : (
                  branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="gen-topic-input" className="field-label">
              Topics
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="gen-topic-input"
                type="text"
                className="input mono"
                disabled={repo.archived}
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="Add topic slugs (e.g. rust, actix-web)"
              />
              <button type="button" className="btn" disabled={repo.archived} onClick={addTopic}>
                <Plus size={14} aria-hidden="true" />
                Add Topic
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {topics.length === 0 ? (
                <span className="field-hint">No topics configured.</span>
              ) : (
                topics.map((t) => (
                  <span key={t} className="topic-chip">
                    {t}
                    {!repo.archived && (
                      <button
                        type="button"
                        aria-label={`Remove topic ${t}`}
                        onClick={() => setTopics((prev) => prev.filter((x) => x !== t))}
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
                    )}
                  </span>
                ))
              )}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
            <input
              type="checkbox"
              disabled={repo.archived}
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
            />
            <span>
              <strong>Template repository</strong> — let users generate new repositories with the
              same directory layout and files
            </span>
          </label>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary" disabled={saving || repo.archived}>
          <Save size={14} aria-hidden="true" />
          {saving ? 'Saving…' : repo.archived ? 'Unarchive Repo to Edit' : 'Save General Settings'}
        </button>
      </div>

      <ConfirmDangerModal
        open={confirmVisOpen}
        title={`Change Visibility to ${visibility.toUpperCase()}`}
        description={
          visibility === 'public'
            ? `Making ${repo.full_name} public exposes all source code, commit history, and issues to anyone on the internet.`
            : `Making ${repo.full_name} private restricts access to you and invited collaborators.`
        }
        confirmLabel={`Confirm ${visibility === 'public' ? 'Public' : 'Private'} Visibility`}
        loading={saving}
        onConfirm={performSave}
        onClose={() => setConfirmVisOpen(false)}
      />
    </form>
  );
};
