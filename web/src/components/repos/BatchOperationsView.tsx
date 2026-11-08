import React, { useState } from 'react';
import { CheckCircle2, Layers, XCircle } from 'lucide-react';
import type { BulkActionPayload, BulkReposResponse } from '../../api/types';
import { useApp } from '../../context/AppContext';
import { ConfirmDangerModal } from '../ui/ConfirmDangerModal';

type BatchMode =
  | 'visibility'
  | 'archive'
  | 'add_topics'
  | 'replace_topics'
  | 'policies'
  | 'delete';

export const BatchOperationsView: React.FC = () => {
  const {
    api,
    repos,
    selectedFullNames,
    toggleSelectRepo,
    setSelectedFullNames,
    refreshRepos,
    refreshAudit,
    pushToast,
  } = useApp();

  const [mode, setMode] = useState<BatchMode>('visibility');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [archived, setArchived] = useState(true);
  const [topicsInput, setTopicsInput] = useState('');
  const [enableIssues, setEnableIssues] = useState(true);
  const [enableWiki, setEnableWiki] = useState(false);
  const [deleteOnMerge, setDeleteOnMerge] = useState(true);

  const [running, setRunning] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [report, setReport] = useState<BulkReposResponse | null>(null);

  const parseTopics = () =>
    topicsInput
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
      .filter(Boolean);

  const runBatch = async (payload: BulkActionPayload) => {
    if (selectedFullNames.length === 0) {
      pushToast('error', 'Select at least one repository first.');
      return;
    }
    setRunning(true);
    setReport(null);
    try {
      const res = await api.executeBulk(selectedFullNames, payload);
      setReport(res);
      if (payload.kind === 'delete_repositories') {
        setSelectedFullNames([]);
      }
      await Promise.all([refreshRepos(), refreshAudit()]);
      pushToast(
        res.failed === 0 ? 'success' : 'info',
        `Batch completed: ${res.succeeded}/${res.total} succeeded.`
      );
    } catch (err: any) {
      pushToast('error', err?.message || 'Batch execution failed.');
    } finally {
      setRunning(false);
      setConfirmDeleteOpen(false);
    }
  };

  const handleTrigger = () => {
    if (selectedFullNames.length === 0) {
      pushToast('error', 'Select at least one repository below.');
      return;
    }
    if (mode === 'delete') {
      setConfirmDeleteOpen(true);
      return;
    }
    if (mode === 'visibility') {
      void runBatch({ kind: 'set_visibility', visibility });
    } else if (mode === 'archive') {
      void runBatch({ kind: 'set_archived', archived });
    } else if (mode === 'add_topics') {
      const t = parseTopics();
      if (!t.length) {
        pushToast('error', 'Enter at least one topic.');
        return;
      }
      void runBatch({ kind: 'add_topics', topics: t });
    } else if (mode === 'replace_topics') {
      void runBatch({ kind: 'replace_topics', topics: parseTopics() });
    } else if (mode === 'policies') {
      void runBatch({
        kind: 'update_features',
        has_issues: enableIssues,
        has_wiki: enableWiki,
        delete_branch_on_merge: deleteOnMerge,
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
      <section className="panel" aria-labelledby="batch-action-heading">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} aria-hidden="true" />
            <h2 id="batch-action-heading">Configure Batch Mutation</h2>
          </div>
          <span className="badge tabular">{selectedFullNames.length} selected</span>
        </div>

        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label htmlFor="batch-mode-select" className="field-label">
              Operation Type
            </label>
            <select
              id="batch-mode-select"
              className="select"
              value={mode}
              onChange={(e) => setMode(e.target.value as BatchMode)}
            >
              <option value="visibility">Change Visibility (Public / Private)</option>
              <option value="add_topics">Append Topics (preserve existing)</option>
              <option value="replace_topics">Replace All Topics</option>
              <option value="policies">Standardize Feature &amp; Merge Policies</option>
              <option value="archive">Archive or Unarchive Repositories</option>
              <option value="delete">Permanently Delete Selected Repositories</option>
            </select>
          </div>

          {mode === 'visibility' && (
            <div className="field">
              <label htmlFor="batch-vis-val" className="field-label">
                Target Visibility
              </label>
              <select
                id="batch-vis-val"
                className="select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          )}

          {mode === 'archive' && (
            <div className="field">
              <label htmlFor="batch-arch-val" className="field-label">
                Archive State
              </label>
              <select
                id="batch-arch-val"
                className="select"
                value={archived ? 'true' : 'false'}
                onChange={(e) => setArchived(e.target.value === 'true')}
              >
                <option value="true">Archive (make read-only)</option>
                <option value="false">Unarchive (restore write access)</option>
              </select>
            </div>
          )}

          {(mode === 'add_topics' || mode === 'replace_topics') && (
            <div className="field">
              <label htmlFor="batch-topics-val" className="field-label">
                Topics (comma-separated)
              </label>
              <input
                id="batch-topics-val"
                type="text"
                className="input mono"
                placeholder="rust, internal, production"
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
              />
            </div>
          )}

          {mode === 'policies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableIssues}
                  onChange={(e) => setEnableIssues(e.target.checked)}
                />
                <span>Enable GitHub Issues</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableWiki}
                  onChange={(e) => setEnableWiki(e.target.checked)}
                />
                <span>Enable Wiki</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteOnMerge}
                  onChange={(e) => setDeleteOnMerge(e.target.checked)}
                />
                <span>Auto-delete head branches after PR merge</span>
              </label>
            </div>
          )}

          {mode === 'delete' && (
            <div className="alert-box alert-error">
              <span>
                <strong>Destructive batch operation:</strong> Permanently deletes every checked
                repository on GitHub. You will be asked to type <code>DELETE SELECTED</code> on the
                next step.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className={`btn ${mode === 'delete' ? 'btn-danger' : 'btn-primary'}`}
              disabled={running || selectedFullNames.length === 0}
              onClick={handleTrigger}
            >
              {running
                ? 'Executing Batch…'
                : `Apply to ${selectedFullNames.length} Selected ${selectedFullNames.length === 1 ? 'Repository' : 'Repositories'}`}
            </button>
          </div>
        </div>
      </section>

      {report && (
        <section className="panel" aria-labelledby="batch-report-heading">
          <div className="panel-header">
            <h2 id="batch-report-heading">Execution Report</h2>
            <span className="mono tabular" style={{ fontSize: 12.5 }}>
              {report.succeeded} succeeded · {report.failed} failed
            </span>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.results.map((r) => (
              <div
                key={r.full_name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-sunken)',
                  gap: 12,
                }}
              >
                <span className="mono" style={{ fontWeight: 500 }}>
                  {r.full_name}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                  {r.ok ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--success-text)' }} aria-hidden="true" />
                  ) : (
                    <XCircle size={14} style={{ color: 'var(--danger-text)' }} aria-hidden="true" />
                  )}
                  {r.message}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="batch-target-list-heading">
        <div className="panel-header">
          <h2 id="batch-target-list-heading">Target Repositories</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSelectedFullNames(repos.map((r) => r.full_name))}
            >
              Select All ({repos.length})
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSelectedFullNames([])}
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="panel-body" style={{ maxHeight: 380, overflowY: 'auto' }}>
          {repos.length === 0 ? (
            <p className="field-hint">No repositories loaded.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {repos.map((r) => {
                const checked = selectedFullNames.includes(r.full_name);
                return (
                  <label
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: checked ? 'var(--bg-selected)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelectRepo(r.full_name)}
                    />
                    <span className="mono" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.full_name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <ConfirmDangerModal
        open={confirmDeleteOpen}
        title={`Delete ${selectedFullNames.length} Selected Repositories`}
        description={`You are about to permanently delete ${selectedFullNames.length} repositories (${selectedFullNames.slice(0, 4).join(', ')}${selectedFullNames.length > 4 ? '…' : ''}). This cannot be undone.`}
        confirmLabel="Delete Selected Repositories"
        requirePhrase="DELETE SELECTED"
        loading={running}
        onConfirm={() => runBatch({ kind: 'delete_repositories', confirm_phrase: 'DELETE SELECTED' })}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};
