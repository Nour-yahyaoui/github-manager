import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CircleDot,
  ExternalLink,
  FileCode2,
  GitBranch,
  Settings,
  Sliders,
  Tag,
  Users,
} from 'lucide-react';
import type { BranchSummary, Repository } from '../../../api/types';
import { useApp } from '../../../context/AppContext';
import { RepoStateBadges } from '../../ui/Badge';
import { AccessHooksTab } from './AccessHooksTab';
import { BranchesTab } from './BranchesTab';
import { DangerZoneTab } from './DangerZoneTab';
import { FeaturesMergeTab } from './FeaturesMergeTab';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { IssuesTriageTab } from './IssuesTriageTab';
import { ReadmeFilesTab } from './ReadmeFilesTab';
import { ReleasesTab } from './ReleasesTab';

type TabKey =
  | 'general'
  | 'features'
  | 'branches'
  | 'files'
  | 'issues'
  | 'releases'
  | 'access'
  | 'danger';

const TABS: Array<{ id: TabKey; label: string; icon: React.ReactNode }> = [
  { id: 'general', label: 'General & Metadata', icon: <Settings size={14} aria-hidden="true" /> },
  { id: 'features', label: 'Features & Merge', icon: <Sliders size={14} aria-hidden="true" /> },
  { id: 'branches', label: 'Branches', icon: <GitBranch size={14} aria-hidden="true" /> },
  { id: 'files', label: 'README & Files', icon: <FileCode2 size={14} aria-hidden="true" /> },
  { id: 'issues', label: 'Issues & PRs', icon: <CircleDot size={14} aria-hidden="true" /> },
  { id: 'releases', label: 'Releases', icon: <Tag size={14} aria-hidden="true" /> },
  { id: 'access', label: 'Access & Webhooks', icon: <Users size={14} aria-hidden="true" /> },
  { id: 'danger', label: 'Danger Zone', icon: <AlertTriangle size={14} aria-hidden="true" /> },
];

export const RepoWorkspace: React.FC<{ owner: string; repoName: string }> = ({
  owner,
  repoName,
}) => {
  const { api, repos, upsertRepoInList, navigateTo } = useApp();

  const cached = repos.find(
    (r) => r.owner.login === owner && r.name === repoName
  );

  const [repo, setRepo] = useState<Repository | null>(cached || null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const loadBranches = useCallback(async () => {
    try {
      const b = await api.listBranches(owner, repoName);
      setBranches(b);
    } catch {
      setBranches([]);
    }
  }, [api, owner, repoName]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [freshRepo, freshBranches] = await Promise.all([
          api.getRepo(owner, repoName),
          api.listBranches(owner, repoName).catch(() => [] as BranchSummary[]),
        ]);
        if (!active) return;
        setRepo(freshRepo);
        setBranches(freshBranches);
        upsertRepoInList(freshRepo);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Failed to load repository details.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [api, owner, repoName, upsertRepoInList]);

  const handleUpdated = (updated: Repository, prevFullName?: string) => {
    setRepo(updated);
    upsertRepoInList(updated, prevFullName);
  };

  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const nextIdx =
      e.key === 'ArrowRight'
        ? (idx + 1) % TABS.length
        : (idx - 1 + TABS.length) % TABS.length;
    setActiveTab(TABS[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  if (loading && !repo) {
    return (
      <div className="panel">
        <div className="panel-body">Loading repository control workspace…</div>
      </div>
    );
  }

  if (error && !repo) {
    return (
      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="alert-box alert-error">{error}</div>
          <div>
            <button type="button" className="btn" onClick={() => navigateTo('ledger')}>
              <ArrowLeft size={14} aria-hidden="true" />
              Back to Repository Ledger
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!repo) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080 }}>
      {/* Top Repository Summary Bar */}
      <div
        className="panel"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => navigateTo('ledger')}
          >
            <ArrowLeft size={13} aria-hidden="true" />
            All Repos
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong className="mono" style={{ fontSize: 15 }}>
                {repo.full_name}
              </strong>
              <RepoStateBadges repo={repo} />
            </div>
            {repo.description && (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                {repo.description}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="mono tabular" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {repo.stargazers_count} stars · {repo.forks_count} forks · {repo.open_issues_count} open
            issues
          </span>
          {repo.html_url && (
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm"
            >
              <ExternalLink size={13} aria-hidden="true" />
              View on GitHub
            </a>
          )}
        </div>
      </div>

      {/* Accessible WAI-ARIA Tab Strip */}
      <p className="tabs-scroll-hint">Swipe or use arrow keys to explore all sections →</p>
      <div className="tabs-strip" role="tablist" aria-label="Repository configuration sections">
        {TABS.map((t, idx) => {
          const selected = activeTab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`repo-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`repo-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className="tab-btn"
              onClick={() => setActiveTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, idx)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div
        id={`repo-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`repo-tab-${activeTab}`}
      >
        {activeTab === 'general' && (
          <GeneralSettingsTab
            repo={repo}
            branches={branches}
            onUpdated={handleUpdated}
          />
        )}
        {activeTab === 'features' && (
          <FeaturesMergeTab repo={repo} onUpdated={handleUpdated} />
        )}
        {activeTab === 'branches' && (
          <BranchesTab
            repo={repo}
            branches={branches}
            onRefreshBranches={loadBranches}
          />
        )}
        {activeTab === 'files' && <ReadmeFilesTab repo={repo} />}
        {activeTab === 'issues' && <IssuesTriageTab repo={repo} />}
        {activeTab === 'releases' && <ReleasesTab repo={repo} branches={branches} />}
        {activeTab === 'access' && <AccessHooksTab repo={repo} />}
        {activeTab === 'danger' && (
          <DangerZoneTab repo={repo} onUpdated={handleUpdated} />
        )}
      </div>
    </div>
  );
};
