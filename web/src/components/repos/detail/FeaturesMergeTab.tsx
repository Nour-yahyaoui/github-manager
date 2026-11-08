import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { Repository } from '../../../api/types';
import { useApp } from '../../../context/AppContext';

interface Props {
  repo: Repository;
  onUpdated: (updated: Repository) => void;
}

export const FeaturesMergeTab: React.FC<Props> = ({ repo, onUpdated }) => {
  const { api, refreshAudit, pushToast } = useApp();

  const [hasIssues, setHasIssues] = useState(repo.has_issues);
  const [hasProjects, setHasProjects] = useState(repo.has_projects);
  const [hasWiki, setHasWiki] = useState(repo.has_wiki);
  const [hasDiscussions, setHasDiscussions] = useState(repo.has_discussions);

  const [allowSquash, setAllowSquash] = useState(repo.allow_squash_merge ?? true);
  const [allowMergeCommit, setAllowMergeCommit] = useState(repo.allow_merge_commit ?? true);
  const [allowRebase, setAllowRebase] = useState(repo.allow_rebase_merge ?? true);
  const [allowAutoMerge, setAllowAutoMerge] = useState(repo.allow_auto_merge ?? false);
  const [deleteOnMerge, setDeleteOnMerge] = useState(repo.delete_branch_on_merge ?? false);
  const [allowUpdateBranch, setAllowUpdateBranch] = useState(repo.allow_update_branch ?? true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHasIssues(repo.has_issues);
    setHasProjects(repo.has_projects);
    setHasWiki(repo.has_wiki);
    setHasDiscussions(repo.has_discussions);
    setAllowSquash(repo.allow_squash_merge ?? true);
    setAllowMergeCommit(repo.allow_merge_commit ?? true);
    setAllowRebase(repo.allow_rebase_merge ?? true);
    setAllowAutoMerge(repo.allow_auto_merge ?? false);
    setDeleteOnMerge(repo.delete_branch_on_merge ?? false);
    setAllowUpdateBranch(repo.allow_update_branch ?? true);
  }, [repo]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowSquash && !allowMergeCommit && !allowRebase) {
      pushToast('error', 'GitHub requires at least one pull request merge strategy enabled.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateRepo(repo.owner.login, repo.name, {
        has_issues: hasIssues,
        has_projects: hasProjects,
        has_wiki: hasWiki,
        has_discussions: hasDiscussions,
        allow_squash_merge: allowSquash,
        allow_merge_commit: allowMergeCommit,
        allow_rebase_merge: allowRebase,
        allow_auto_merge: allowAutoMerge,
        delete_branch_on_merge: deleteOnMerge,
        allow_update_branch: allowUpdateBranch,
      });
      onUpdated(updated);
      void refreshAudit();
      pushToast('success', 'Saved feature & merge policies.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to update policies.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section className="panel" aria-labelledby="feat-heading">
        <div className="panel-header">
          <h3 id="feat-heading">Repository Features</h3>
        </div>
        <div className="panel-body">
          <div className="setting-row">
            <div>
              <div className="setting-title">Issues</div>
              <p className="setting-desc">
                Integrated issue tracker, labels, milestones, and task cross-references.
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Enable Issues"
              disabled={repo.archived}
              checked={hasIssues}
              onChange={(e) => setHasIssues(e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">Projects</div>
              <p className="setting-desc">Repository-level project boards and roadmaps.</p>
            </div>
            <input
              type="checkbox"
              aria-label="Enable Projects"
              disabled={repo.archived}
              checked={hasProjects}
              onChange={(e) => setHasProjects(e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">Wiki</div>
              <p className="setting-desc">Host long-form documentation in a git-backed wiki.</p>
            </div>
            <input
              type="checkbox"
              aria-label="Enable Wiki"
              disabled={repo.archived}
              checked={hasWiki}
              onChange={(e) => setHasWiki(e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">Discussions</div>
              <p className="setting-desc">Threaded Q&amp;A and community announcements.</p>
            </div>
            <input
              type="checkbox"
              aria-label="Enable Discussions"
              disabled={repo.archived}
              checked={hasDiscussions}
              onChange={(e) => setHasDiscussions(e.target.checked)}
            />
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="merge-heading">
        <div className="panel-header">
          <h3 id="merge-heading">Pull Request &amp; Merge Policies</h3>
        </div>
        <div className="panel-body">
          <div className="setting-row">
            <div>
              <div className="setting-title">Allow Squash Merging</div>
              <p className="setting-desc">
                Combine all commits from a head branch into a single commit on the base branch.
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Allow Squash Merging"
              disabled={repo.archived}
              checked={allowSquash}
              onChange={(e) => setAllowSquash(e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">Allow Merge Commits</div>
              <p className="setting-desc">
                Add all commits from the head branch to the base branch via a merge commit.
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Allow Merge Commits"
              disabled={repo.archived}
              checked={allowMergeCommit}
              onChange={(e) => setAllowMergeCommit(e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">Allow Rebase Merging</div>
              <p className="setting-desc">
                Fast-forward commits onto the base branch without a merge commit.
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Allow Rebase Merging"
              disabled={repo.archived}
              checked={allowRebase}
              onChange={(e) => setAllowRebase(e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">Automatically Delete Head Branches</div>
              <p className="setting-desc">
                Delete merged pull request branches automatically to keep refs clean.
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Automatically Delete Head Branches"
              disabled={repo.archived}
              checked={deleteOnMerge}
              onChange={(e) => setDeleteOnMerge(e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">Allow Auto-Merge</div>
              <p className="setting-desc">
                Merge pull requests automatically once required status checks and reviews pass.
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Allow Auto-Merge"
              disabled={repo.archived}
              checked={allowAutoMerge}
              onChange={(e) => setAllowAutoMerge(e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-title">Always Suggest Updating Pull Request Branches</div>
              <p className="setting-desc">
                Show a one-click option to rebase/merge base branch updates into open PRs.
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Suggest updating pull request branches"
              disabled={repo.archived}
              checked={allowUpdateBranch}
              onChange={(e) => setAllowUpdateBranch(e.target.checked)}
            />
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary" disabled={saving || repo.archived}>
          <Save size={14} aria-hidden="true" />
          {saving ? 'Saving…' : 'Save Feature & Merge Policies'}
        </button>
      </div>
    </form>
  );
};
