import React, { useState } from 'react';
import { GitBranch, Plus, Shield, Trash2 } from 'lucide-react';
import type { BranchSummary, Repository } from '../../../api/types';
import { useApp } from '../../../context/AppContext';

interface Props {
  repo: Repository;
  branches: BranchSummary[];
  onRefreshBranches: () => Promise<void>;
}

export const BranchesTab: React.FC<Props> = ({ repo, branches, onRefreshBranches }) => {
  const { api, refreshAudit, pushToast } = useApp();

  const [newBranchName, setNewBranchName] = useState('');
  const [sourceBranch, setSourceBranch] = useState(repo.default_branch);
  const [creating, setCreating] = useState(false);

  const [renamingBranch, setRenamingBranch] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyBranch, setBusyBranch] = useState<string | null>(null);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBranchName.trim();
    if (!clean) return;
    const baseObj =
      branches.find((b) => b.name === sourceBranch) || branches[0];
    if (!baseObj) {
      pushToast('error', 'Initialize repository with at least one commit before creating branches.');
      return;
    }

    setCreating(true);
    try {
      await api.createBranch(repo.owner.login, repo.name, clean, baseObj.commit.sha);
      setNewBranchName('');
      await Promise.all([onRefreshBranches(), refreshAudit()]);
      pushToast('success', `Created branch '${clean}'`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to create branch.');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (branch: string) => {
    const clean = renameValue.trim();
    if (!clean || clean === branch) {
      setRenamingBranch(null);
      return;
    }
    setBusyBranch(branch);
    try {
      await api.renameBranch(repo.owner.login, repo.name, branch, clean);
      setRenamingBranch(null);
      await Promise.all([onRefreshBranches(), refreshAudit()]);
      pushToast('success', `Renamed '${branch}' to '${clean}'`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to rename branch.');
    } finally {
      setBusyBranch(null);
    }
  };

  const handleDelete = async (branch: string) => {
    setBusyBranch(branch);
    try {
      await api.deleteBranch(repo.owner.login, repo.name, branch);
      await Promise.all([onRefreshBranches(), refreshAudit()]);
      pushToast('success', `Deleted branch '${branch}'`);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to delete branch.');
    } finally {
      setBusyBranch(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {!repo.archived && branches.length > 0 && (
        <section className="panel" aria-labelledby="new-branch-heading">
          <div className="panel-header">
            <h3 id="new-branch-heading">Create Branch</h3>
          </div>
          <form
            onSubmit={(e) => void handleCreateBranch(e)}
            className="panel-body"
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="nb-name" className="field-label">
                New Branch Name
              </label>
              <input
                id="nb-name"
                type="text"
                className="input mono"
                placeholder="feat/api-cache"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                required
              />
            </div>

            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor="nb-source" className="field-label">
                Source Ref
              </label>
              <select
                id="nb-source"
                className="select mono"
                value={sourceBranch}
                onChange={(e) => setSourceBranch(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.commit.sha.slice(0, 7)})
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary" disabled={creating}>
              <Plus size={14} aria-hidden="true" />
              {creating ? 'Creating…' : 'Create Branch'}
            </button>
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="branch-list-heading">
        <div className="panel-header">
          <h3 id="branch-list-heading">Branches ({branches.length})</h3>
        </div>

        {branches.length === 0 ? (
          <div className="empty-state">
            <GitBranch size={24} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <h3>No branches found</h3>
            <p>Empty repository — commit a README in the Files tab to initialize the default branch.</p>
          </div>
        ) : (
          <div className="table-scroll" style={{ border: 'none', borderRadius: 0 }}>
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Head Commit</th>
                  <th>Flags</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => {
                  const isDefault = b.name === repo.default_branch;
                  const isRenaming = renamingBranch === b.name;
                  return (
                    <tr key={b.name}>
                      <td>
                        {isRenaming ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="text"
                              className="input mono"
                              style={{ maxWidth: 220 }}
                              aria-label={`New name for ${b.name}`}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => void handleRename(b.name)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setRenamingBranch(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="mono" style={{ fontWeight: 600 }}>
                            {b.name}
                          </span>
                        )}
                      </td>
                      <td className="mono tabular" style={{ fontSize: 12.5 }}>
                        {b.commit.sha.slice(0, 10)}
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {isDefault && <span className="badge badge-public">Default</span>}
                          {b.protected && (
                            <span className="badge badge-private">
                              <Shield size={11} aria-hidden="true" />
                              Protected
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!repo.archived && (
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busyBranch === b.name}
                              onClick={() => {
                                setRenamingBranch(b.name);
                                setRenameValue(b.name);
                              }}
                            >
                              Rename
                            </button>
                            {!isDefault && (
                              <button
                                type="button"
                                className="btn btn-danger-outline btn-sm icon-btn"
                                disabled={busyBranch === b.name || b.protected}
                                aria-label={`Delete branch ${b.name}`}
                                title={
                                  b.protected
                                    ? 'Protected branches cannot be deleted directly'
                                    : `Delete branch ${b.name}`
                                }
                                onClick={() => void handleDelete(b.name)}
                              >
                                <Trash2 size={13} aria-hidden="true" />
                              </button>
                            )}
                          </div>
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
