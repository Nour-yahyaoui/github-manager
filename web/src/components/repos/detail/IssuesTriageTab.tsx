import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleDot, GitPullRequest, Plus } from 'lucide-react';
import type { IssueItem, Repository } from '../../../api/types';
import { useApp } from '../../../context/AppContext';

interface Props {
  repo: Repository;
}

export const IssuesTriageTab: React.FC<Props> = ({ repo }) => {
  const { api, refreshAudit, pushToast } = useApp();

  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [items, setItems] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyNum, setBusyNum] = useState<number | null>(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listIssues(repo.owner.login, repo.name, stateFilter);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api, repo.owner.login, repo.name, stateFilter]);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api.createIssue(repo.owner.login, repo.name, {
        title: title.trim(),
        body: body.trim() || undefined,
      });
      setTitle('');
      setBody('');
      setShowCreate(false);
      await Promise.all([loadIssues(), refreshAudit()]);
      pushToast('success', 'Created new issue.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to create issue.');
    } finally {
      setCreating(false);
    }
  };

  const toggleState = async (item: IssueItem) => {
    const nextState = item.state === 'open' ? 'closed' : 'open';
    setBusyNum(item.number);
    try {
      await api.updateIssueState(repo.owner.login, repo.name, item.number, nextState);
      await Promise.all([loadIssues(), refreshAudit()]);
      pushToast('success', `#${item.number} marked ${nextState}.`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to update issue state.');
    } finally {
      setBusyNum(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showCreate && (
        <section className="panel" aria-labelledby="new-issue-heading">
          <div className="panel-header">
            <h3 id="new-issue-heading">Open New Issue</h3>
          </div>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="panel-body"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="field">
              <label htmlFor="ni-title" className="field-label">
                Title
              </label>
              <input
                id="ni-title"
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ni-body" className="field-label">
                Description (Markdown)
              </label>
              <textarea
                id="ni-body"
                className="textarea"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating…' : 'Open Issue'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="issues-list-heading">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 id="issues-list-heading">Issues &amp; Pull Requests</h3>
            <select
              className="select"
              style={{ width: 'auto', minHeight: 32, padding: '4px 10px' }}
              aria-label="Filter issues by state"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as 'open' | 'closed' | 'all')}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </div>
          {!repo.archived && repo.has_issues && !showCreate && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} aria-hidden="true" />
              New Issue
            </button>
          )}
        </div>

        {loading ? (
          <div className="panel-body">Loading issues…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <CircleDot size={24} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <h3>No {stateFilter === 'all' ? '' : stateFilter} issues or pull requests</h3>
            <p>
              {repo.has_issues
                ? 'Open an issue above to track bugs or tasks on this repository.'
                : 'Issues are currently disabled on this repository (enable them in Features & Merge).'}
            </p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Issues and pull requests table (scroll horizontally for more columns)" style={{ border: 'none', borderRadius: 0 }}>
            <table className="ledger-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>#</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>State</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isPr = Boolean(it.pull_request);
                  return (
                    <tr key={it.id}>
                      <td className="mono tabular">#{it.number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{it.title}</div>
                        {it.labels.length > 0 && (
                          <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                            {it.labels.map((lb) => (
                              <span key={lb.name} className="topic-chip">
                                {lb.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {isPr ? (
                          <span className="badge">
                            <GitPullRequest size={11} aria-hidden="true" />
                            PR
                          </span>
                        ) : (
                          <span className="badge">Issue</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${it.state === 'open' ? 'badge-public' : 'badge-archived'}`}
                        >
                          {it.state === 'open' ? (
                            <CircleDot size={11} aria-hidden="true" />
                          ) : (
                            <CheckCircle2 size={11} aria-hidden="true" />
                          )}
                          {it.state}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!repo.archived && !isPr && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busyNum === it.number}
                            onClick={() => void toggleState(it)}
                          >
                            {it.state === 'open' ? 'Close' : 'Reopen'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
