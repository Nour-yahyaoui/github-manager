import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  Edit3,
  FolderPlus,
  GitBranch,
  Layers,
  Search,
  Settings2,
  Star,
  Trash2,
} from 'lucide-react';
import type { Repository } from '../../api/types';
import { useApp } from '../../context/AppContext';
import { RepoStateBadges } from '../ui/Badge';
import { ConfirmDangerModal } from '../ui/ConfirmDangerModal';
import { QuickEditDrawer } from './QuickEditDrawer';

type ScopeFilter = 'all' | 'public' | 'private' | 'archived' | 'templates_forks';
type SortMode = 'pushed' | 'name' | 'stars' | 'issues' | 'size';

function formatRelativeDate(iso?: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSizeKb(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export const RepoLedgerView: React.FC = () => {
  const {
    api,
    repos,
    reposLoading,
    reposError,
    selectedFullNames,
    toggleSelectRepo,
    setSelectedFullNames,
    navigateTo,
    refreshRepos,
    removeRepoFromList,
    refreshAudit,
    pushToast,
  } = useApp();

  const [scope, setScope] = useState<ScopeFilter>('all');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [langFilter, setLangFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortMode>('pushed');

  const [quickEditRepo, setQuickEditRepo] = useState<Repository | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Repository | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => {
    let pub = 0;
    let priv = 0;
    let arch = 0;
    let tf = 0;
    for (const r of repos) {
      if (r.private) priv++;
      else pub++;
      if (r.archived) arch++;
      if (r.is_template || r.fork) tf++;
    }
    return { total: repos.length, pub, priv, arch, tf };
  }, [repos]);

  const owners = useMemo(
    () => Array.from(new Set(repos.map((r) => r.owner.login))).sort(),
    [repos]
  );

  const languages = useMemo(
    () =>
      Array.from(
        new Set(repos.map((r) => r.language).filter((l): l is string => Boolean(l)))
      ).sort(),
    [repos]
  );

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = repos.filter((r) => {
      if (scope === 'public' && r.private) return false;
      if (scope === 'private' && !r.private) return false;
      if (scope === 'archived' && !r.archived) return false;
      if (scope === 'templates_forks' && !r.is_template && !r.fork) return false;

      if (ownerFilter !== 'all' && r.owner.login !== ownerFilter) return false;
      if (langFilter !== 'all' && r.language !== langFilter) return false;

      if (q) {
        const hay = [
          r.full_name,
          r.description || '',
          r.language || '',
          ...(r.topics || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'name') return a.full_name.localeCompare(b.full_name);
      if (sortBy === 'stars') return b.stargazers_count - a.stargazers_count;
      if (sortBy === 'issues') return b.open_issues_count - a.open_issues_count;
      if (sortBy === 'size') return b.size - a.size;
      const ta = new Date(a.pushed_at || a.updated_at || 0).getTime();
      const tb = new Date(b.pushed_at || b.updated_at || 0).getTime();
      return tb - ta;
    });

    return list;
  }, [repos, scope, ownerFilter, langFilter, search, sortBy]);

  const allVisibleSelected =
    filteredRepos.length > 0 &&
    filteredRepos.every((r) => selectedFullNames.includes(r.full_name));

  const handleToggleAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredRepos.map((r) => r.full_name));
      setSelectedFullNames((prev) => prev.filter((name) => !visibleSet.has(name)));
    } else {
      const merged = new Set([
        ...selectedFullNames,
        ...filteredRepos.map((r) => r.full_name),
      ]);
      setSelectedFullNames(Array.from(merged));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteRepo(deleteTarget.owner.login, deleteTarget.name);
      removeRepoFromList(deleteTarget.full_name);
      void refreshAudit();
      pushToast('success', `Deleted ${deleteTarget.full_name}`);
      setDeleteTarget(null);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to delete repository.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Operational Filter Tiles */}
      <div className="summary-strip" role="group" aria-label="Filter repositories by category">
        <button
          type="button"
          className="metric-tile"
          aria-pressed={scope === 'all'}
          onClick={() => setScope('all')}
        >
          <span className="metric-label">All Repositories</span>
          <span className="metric-value">{counts.total}</span>
        </button>

        <button
          type="button"
          className="metric-tile"
          aria-pressed={scope === 'public'}
          onClick={() => setScope('public')}
        >
          <span className="metric-label">Public</span>
          <span className="metric-value">{counts.pub}</span>
        </button>

        <button
          type="button"
          className="metric-tile"
          aria-pressed={scope === 'private'}
          onClick={() => setScope('private')}
        >
          <span className="metric-label">Private</span>
          <span className="metric-value">{counts.priv}</span>
        </button>

        <button
          type="button"
          className="metric-tile"
          aria-pressed={scope === 'archived'}
          onClick={() => setScope('archived')}
        >
          <span className="metric-label">Archived</span>
          <span className="metric-value">{counts.arch}</span>
        </button>

        <button
          type="button"
          className="metric-tile"
          aria-pressed={scope === 'templates_forks'}
          onClick={() => setScope('templates_forks')}
        >
          <span className="metric-label">Templates &amp; Forks</span>
          <span className="metric-value">{counts.tf}</span>
        </button>
      </div>

      {reposError && (
        <div className="alert-box alert-error" style={{ marginBottom: 16 }} role="alert">
          <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <strong>Failed to load repositories:</strong> {reposError}
          </div>
          <button type="button" className="btn btn-sm" onClick={() => void refreshRepos()}>
            Retry
          </button>
        </div>
      )}

      {/* Search & Facet Toolbar */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} aria-hidden="true" />
          <input
            id="repo-ledger-search"
            type="search"
            className="input"
            aria-label="Filter repositories by name, description, or topic"
            placeholder="Filter by name, description, topic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd className="search-kbd" aria-hidden="true">
            /
          </kbd>
        </div>

        <select
          className="select"
          style={{ width: 'auto', minWidth: 145 }}
          aria-label="Filter by owner"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        >
          <option value="all">All owners ({owners.length})</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              @{o}
            </option>
          ))}
        </select>

        <select
          className="select"
          style={{ width: 'auto', minWidth: 145 }}
          aria-label="Filter by primary language"
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
        >
          <option value="all">All languages</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          className="select"
          style={{ width: 'auto', minWidth: 168 }}
          aria-label="Sort repositories"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortMode)}
        >
          <option value="pushed">Sort: Recently pushed</option>
          <option value="name">Sort: Name (A–Z)</option>
          <option value="stars">Sort: Stars</option>
          <option value="issues">Sort: Open issues</option>
          <option value="size">Sort: Disk size</option>
        </select>
      </div>

      {/* Multi-select Batch Bar */}
      {selectedFullNames.length > 0 && (
        <div className="batch-bar" role="region" aria-label="Selected repositories actions">
          <span className="tabular" style={{ fontSize: 13 }}>
            <strong>{selectedFullNames.length}</strong>{' '}
            {selectedFullNames.length === 1 ? 'repository' : 'repositories'} selected
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigateTo('batch')}
            >
              <Layers size={13} aria-hidden="true" />
              Open Batch Operations ({selectedFullNames.length})
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSelectedFullNames([])}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Repository Table */}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Repositories table">
        {reposLoading && repos.length === 0 ? (
          <div className="empty-state">
            <p>Loading repositories from GitHub REST API…</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="empty-state">
            <BookMarked size={28} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <h3>
              {repos.length === 0
                ? 'No repositories found on this account'
                : 'No repositories match your active filters'}
            </h3>
            <p>
              {repos.length === 0
                ? 'Create your first repository from this control plane to initialize metadata, visibility, and branch settings.'
                : 'Clear search keywords or reset category filters to see all repositories.'}
            </p>
            {repos.length === 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigateTo('create')}
              >
                <FolderPlus size={15} aria-hidden="true" />
                Create Repository
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setScope('all');
                  setSearch('');
                  setOwnerFilter('all');
                  setLangFilter('all');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <table className="ledger-table">
            <thead>
              <tr>
                <th style={{ width: 38 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    aria-label="Select all visible repositories"
                    onChange={handleToggleAllVisible}
                  />
                </th>
                <th>Repository &amp; Description</th>
                <th>Status</th>
                <th>Branch &amp; Stack</th>
                <th className="tabular">Metrics</th>
                <th className="tabular">Last Push</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRepos.map((repo) => {
                const isSelected = selectedFullNames.includes(repo.full_name);
                return (
                  <tr key={repo.id} className={isSelected ? 'row-selected' : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        aria-label={`Select ${repo.full_name}`}
                        onChange={() => toggleSelectRepo(repo.full_name)}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="repo-name-btn"
                          onClick={() =>
                            navigateTo('repo-detail', {
                              owner: repo.owner.login,
                              repo: repo.name,
                            })
                          }
                        >
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                            {repo.owner.login}/
                          </span>
                          {repo.name}
                        </button>
                      </div>
                      <p className="repo-desc">
                        {repo.description || (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No description set
                          </span>
                        )}
                      </p>
                      {repo.topics && repo.topics.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                          {repo.topics.slice(0, 5).map((topic) => (
                            <span key={topic} className="topic-chip">
                              {topic}
                            </span>
                          ))}
                          {repo.topics.length > 5 && (
                            <span className="badge tabular">+{repo.topics.length - 5}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <RepoStateBadges repo={repo} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span
                          className="mono"
                          style={{
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <GitBranch size={12} aria-hidden="true" />
                          {repo.default_branch}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {repo.language || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="tabular mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span title="Stars" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Star size={12} aria-hidden="true" />
                          {repo.stargazers_count}
                        </span>
                        <span title="Open issues" style={{ color: 'var(--text-secondary)' }}>
                          {repo.open_issues_count} iss
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>
                        {formatSizeKb(repo.size)}
                      </div>
                    </td>
                    <td
                      className="tabular"
                      style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                    >
                      {formatRelativeDate(repo.pushed_at || repo.updated_at)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          aria-label={`Quick edit ${repo.full_name}`}
                          onClick={() => setQuickEditRepo(repo)}
                        >
                          <Edit3 size={13} aria-hidden="true" />
                          Quick Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          aria-label={`Open full workspace for ${repo.full_name}`}
                          onClick={() =>
                            navigateTo('repo-detail', {
                              owner: repo.owner.login,
                              repo: repo.name,
                            })
                          }
                        >
                          <Settings2 size={13} aria-hidden="true" />
                          Manage
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-outline btn-sm icon-btn"
                          aria-label={`Delete ${repo.full_name}`}
                          title={`Delete ${repo.full_name}`}
                          onClick={() => setDeleteTarget(repo)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <QuickEditDrawer repo={quickEditRepo} onClose={() => setQuickEditRepo(null)} />

      <ConfirmDangerModal
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.full_name || 'Repository'}`}
        description={`This action permanently deletes ${deleteTarget?.full_name || ''} on GitHub, including all git history, issues, pull requests, releases, and wiki pages. This cannot be undone.`}
        confirmLabel="Permanently Delete Repository"
        requirePhrase={deleteTarget?.full_name}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
