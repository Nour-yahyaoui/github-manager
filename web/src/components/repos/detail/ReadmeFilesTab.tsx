import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, FileText, Folder, Save } from 'lucide-react';
import type { ContentEntry, DecodedReadme, Repository } from '../../../api/types';
import { useApp } from '../../../context/AppContext';

interface Props {
  repo: Repository;
}

export const ReadmeFilesTab: React.FC<Props> = ({ repo }) => {
  const { api, refreshAudit, pushToast } = useApp();

  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [readme, setReadme] = useState<DecodedReadme | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('docs: update README.md');
  const [committing, setCommitting] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const [rootRes, readmeRes] = await Promise.all([
        api.listRootContents(repo.owner.login, repo.name).catch(() => [] as ContentEntry[]),
        api.getReadme(repo.owner.login, repo.name).catch(() => null),
      ]);
      setEntries(rootRes);
      setReadme(readmeRes);
      setDraftContent(readmeRes?.decoded_content || `# ${repo.name}\n\n${repo.description || ''}\n`);
    } finally {
      setLoading(false);
    }
  }, [api, repo.owner.login, repo.name, repo.description]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleCommitReadme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) {
      pushToast('error', 'Commit message is required.');
      return;
    }
    setCommitting(true);
    try {
      const targetPath = readme?.path || 'README.md';
      await api.putFile(repo.owner.login, repo.name, targetPath, {
        message: commitMessage.trim(),
        content_utf8: draftContent,
        sha: readme?.sha,
        branch: repo.default_branch,
      });
      setEditing(false);
      await Promise.all([loadFiles(), refreshAudit()]);
      pushToast('success', `Committed ${targetPath} to ${repo.default_branch}`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to commit README.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section className="panel" aria-labelledby="root-files-heading">
        <div className="panel-header">
          <h3 id="root-files-heading">Root Directory ({entries.length})</h3>
        </div>
        {loading ? (
          <div className="panel-body">Loading repository tree…</div>
        ) : entries.length === 0 ? (
          <div className="panel-body">
            <span className="field-hint">Repository root is currently empty.</span>
          </div>
        ) : (
          <div className="panel-body" style={{ padding: 0 }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {entries.map((item) => (
                <li
                  key={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 18px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {item.type === 'dir' ? (
                      <Folder size={15} style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                    ) : (
                      <FileText size={15} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
                    )}
                    <span className="mono" style={{ fontSize: 13 }}>
                      {item.name}
                    </span>
                  </span>
                  <span className="mono tabular" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {item.type === 'dir' ? 'dir' : `${item.size} B`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="readme-panel-heading">
        <div className="panel-header">
          <h3 id="readme-panel-heading">{readme?.name || 'README.md'}</h3>
          {!repo.archived && !editing && (
            <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
              <Edit3 size={13} aria-hidden="true" />
              {readme ? 'Edit & Commit README' : 'Create README.md'}
            </button>
          )}
        </div>

        <div className="panel-body">
          {editing ? (
            <form
              onSubmit={(e) => void handleCommitReadme(e)}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div className="field">
                <label htmlFor="readme-editor-textarea" className="field-label">
                  Markdown Content
                </label>
                <textarea
                  id="readme-editor-textarea"
                  className="textarea mono"
                  rows={12}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="readme-commit-msg" className="field-label">
                  Commit Message (target branch: <code>{repo.default_branch}</code>)
                </label>
                <input
                  id="readme-commit-msg"
                  type="text"
                  className="input"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  disabled={committing}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={committing}>
                  <Save size={14} aria-hidden="true" />
                  {committing ? 'Committing…' : 'Commit to GitHub'}
                </button>
              </div>
            </form>
          ) : readme ? (
            <pre
              className="mono"
              style={{
                margin: 0,
                padding: 16,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-sunken)',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              {readme.decoded_content}
            </pre>
          ) : (
            <span className="field-hint">
              No README detected on default branch. Use &ldquo;Create README.md&rdquo; to commit one directly.
            </span>
          )}
        </div>
      </section>
    </div>
  );
};
