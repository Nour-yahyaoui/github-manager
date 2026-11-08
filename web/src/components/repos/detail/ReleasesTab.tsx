import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import type { BranchSummary, ReleaseItem, Repository } from '../../../api/types';
import { useApp } from '../../../context/AppContext';

interface Props {
  repo: Repository;
  branches: BranchSummary[];
}

export const ReleasesTab: React.FC<Props> = ({ repo, branches }) => {
  const { api, refreshAudit, pushToast } = useApp();

  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [tagName, setTagName] = useState('');
  const [targetBranch, setTargetBranch] = useState(repo.default_branch);
  const [releaseTitle, setReleaseTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(false);
  const [prerelease, setPrerelease] = useState(false);
  const [autoNotes, setAutoNotes] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const loadReleases = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listReleases(repo.owner.login, repo.name);
      setReleases(list);
    } catch {
      setReleases([]);
    } finally {
      setLoading(false);
    }
  }, [api, repo.owner.login, repo.name]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    setPublishing(true);
    try {
      await api.createRelease(repo.owner.login, repo.name, {
        tag_name: tagName.trim(),
        target_commitish: targetBranch || repo.default_branch,
        name: releaseTitle.trim() || tagName.trim(),
        body: notes.trim() || undefined,
        draft,
        prerelease,
        generate_release_notes: autoNotes,
      });
      setTagName('');
      setReleaseTitle('');
      setNotes('');
      setShowCreate(false);
      await Promise.all([loadReleases(), refreshAudit()]);
      pushToast('success', `Published release ${tagName.trim()}`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to publish release.');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id: number, tag: string) => {
    try {
      await api.deleteRelease(repo.owner.login, repo.name, id);
      await Promise.all([loadReleases(), refreshAudit()]);
      pushToast('success', `Deleted release ${tag}`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to delete release.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showCreate && (
        <section className="panel" aria-labelledby="pub-rel-heading">
          <div className="panel-header">
            <h3 id="pub-rel-heading">Create Release &amp; Git Tag</h3>
          </div>
          <form
            onSubmit={(e) => void handlePublish(e)}
            className="panel-body"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="grid-2">
              <div className="field">
                <label htmlFor="rel-tag" className="field-label">
                  Tag Name
                </label>
                <input
                  id="rel-tag"
                  type="text"
                  className="input mono"
                  placeholder="v0.2.0"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="rel-target" className="field-label">
                  Target Branch
                </label>
                <select
                  id="rel-target"
                  className="select mono"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
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
              <label htmlFor="rel-title" className="field-label">
                Release Title
              </label>
              <input
                id="rel-title"
                type="text"
                className="input"
                placeholder="v0.2.0 — Batch Policies & Webhook Controls"
                value={releaseTitle}
                onChange={(e) => setReleaseTitle(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="rel-notes" className="field-label">
                Release Notes (optional Markdown)
              </label>
              <textarea
                id="rel-notes"
                className="textarea"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoNotes}
                  onChange={(e) => setAutoNotes(e.target.checked)}
                />
                <span>Auto-generate GitHub release notes</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={prerelease}
                  onChange={(e) => setPrerelease(e.target.checked)}
                />
                <span>Pre-release</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
                <span>Save as Draft</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={publishing}>
                {publishing ? 'Publishing…' : draft ? 'Save Draft Release' : 'Publish Release'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="releases-heading">
        <div className="panel-header">
          <h3 id="releases-heading">Releases ({releases.length})</h3>
          {!repo.archived && !showCreate && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={13} aria-hidden="true" />
              New Release
            </button>
          )}
        </div>

        {loading ? (
          <div className="panel-body">Loading releases…</div>
        ) : releases.length === 0 ? (
          <div className="empty-state">
            <Tag size={24} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <h3>No releases published yet</h3>
            <p>Tag a commit and publish release notes directly from here.</p>
          </div>
        ) : (
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {releases.map((rel) => (
              <div
                key={rel.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {rel.tag_name}
                    </span>
                    {rel.name && rel.name !== rel.tag_name && <span>— {rel.name}</span>}
                    {rel.draft && <span className="badge badge-archived">Draft</span>}
                    {rel.prerelease && <span className="badge badge-private">Pre-release</span>}
                  </div>
                  {rel.body && (
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {rel.body}
                    </p>
                  )}
                </div>
                {!repo.archived && (
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm icon-btn"
                    aria-label={`Delete release ${rel.tag_name}`}
                    onClick={() => void handleDelete(rel.id, rel.tag_name)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
