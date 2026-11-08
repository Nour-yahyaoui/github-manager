import React, { useState } from 'react';
import { AlertCircle, FolderPlus, Globe, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const GITIGNORE_TEMPLATES = [
  '',
  'Rust',
  'Node',
  'Python',
  'Go',
  'Terraform',
  'Java',
  'C++',
  'VisualStudio',
  'Swift',
];

const LICENSE_TEMPLATES = [
  { value: '', label: 'None' },
  { value: 'mit', label: 'MIT License' },
  { value: 'apache-2.0', label: 'Apache License 2.0' },
  { value: 'gpl-3.0', label: 'GNU General Public License v3.0' },
  { value: 'bsd-3-clause', label: 'BSD 3-Clause License' },
  { value: 'mpl-2.0', label: 'Mozilla Public License 2.0' },
  { value: 'unlicense', label: 'The Unlicense' },
];

export const CreateRepoView: React.FC = () => {
  const { api, auth, orgs, upsertRepoInList, refreshAudit, navigateTo, pushToast } = useApp();

  const personalLogin = auth?.user?.login || 'me';
  const [ownerOrg, setOwnerOrg] = useState('');
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [description, setDescription] = useState('');
  const [homepage, setHomepage] = useState('');
  const [topicsRaw, setTopicsRaw] = useState('');

  const [autoInit, setAutoInit] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('');
  const [licenseTemplate, setLicenseTemplate] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);

  const [hasIssues, setHasIssues] = useState(true);
  const [hasProjects, setHasProjects] = useState(false);
  const [hasWiki, setHasWiki] = useState(false);
  const [deleteBranchOnMerge, setDeleteBranchOnMerge] = useState(true);
  const [allowSquash, setAllowSquash] = useState(true);
  const [allowMergeCommit, setAllowMergeCommit] = useState(true);
  const [allowRebase, setAllowRebase] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Repository name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let created = await api.createRepo({
        name: cleanName,
        org: ownerOrg || undefined,
        description: description.trim() || undefined,
        homepage: homepage.trim() || undefined,
        visibility,
        private: visibility === 'private',
        auto_init: autoInit,
        gitignore_template: autoInit && gitignoreTemplate ? gitignoreTemplate : undefined,
        license_template: autoInit && licenseTemplate ? licenseTemplate : undefined,
        is_template: isTemplate,
        has_issues: hasIssues,
        has_projects: hasProjects,
        has_wiki: hasWiki,
        allow_squash_merge: allowSquash,
        allow_merge_commit: allowMergeCommit,
        allow_rebase_merge: allowRebase,
        delete_branch_on_merge: deleteBranchOnMerge,
      });

      const initialTopics = topicsRaw
        .split(',')
        .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
        .filter(Boolean);

      if (initialTopics.length > 0) {
        try {
          const savedTopics = await api.replaceTopics(
            created.owner.login,
            created.name,
            initialTopics
          );
          created = { ...created, topics: savedTopics };
        } catch {
          /* non-fatal if topics need a moment on newly created repo */
        }
      }

      upsertRepoInList(created);
      void refreshAudit();
      pushToast('success', `Created repository ${created.full_name}`);
      navigateTo('repo-detail', { owner: created.owner.login, repo: created.name });
    } catch (err: any) {
      const msg = err?.message || 'Repository creation failed.';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const previewOwner = ownerOrg || personalLogin;

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 }}
    >
      {error && (
        <div className="alert-box alert-error" role="alert">
          <AlertCircle size={17} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <section className="panel" aria-labelledby="cr-identity-heading">
        <div className="panel-header">
          <h2 id="cr-identity-heading">Identity &amp; Visibility</h2>
          <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {previewOwner}/{name.trim() || 'repository-name'}
          </span>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="cr-owner" className="field-label">
                Owner
              </label>
              <select
                id="cr-owner"
                className="select"
                value={ownerOrg}
                onChange={(e) => setOwnerOrg(e.target.value)}
              >
                <option value="">@{personalLogin} (Personal account)</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.login}>
                    @{o.login} (Organization)
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cr-name" className="field-label">
                Repository Name
              </label>
              <input
                id="cr-name"
                type="text"
                className="input mono"
                placeholder="e.g. payment-gateway-rs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <button
              type="button"
              className="metric-tile"
              aria-pressed={visibility === 'private'}
              onClick={() => setVisibility('private')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
                <Lock size={15} aria-hidden="true" />
                Private
              </span>
              <span className="field-hint">
                Only you and explicitly invited collaborators can view or clone.
              </span>
            </button>

            <button
              type="button"
              className="metric-tile"
              aria-pressed={visibility === 'public'}
              onClick={() => setVisibility('public')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
                <Globe size={15} aria-hidden="true" />
                Public
              </span>
              <span className="field-hint">
                Anyone on the internet can view and fork this repository.
              </span>
            </button>
          </div>

          <div className="field">
            <label htmlFor="cr-desc" className="field-label">
              Description
            </label>
            <input
              id="cr-desc"
              type="text"
              className="input"
              placeholder="Concise summary of purpose and architecture…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="cr-homepage" className="field-label">
                Homepage URL (optional)
              </label>
              <input
                id="cr-homepage"
                type="text"
                className="input"
                placeholder="https://docs.example.com"
                value={homepage}
                onChange={(e) => setHomepage(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="cr-topics" className="field-label">
                Initial Topics (comma-separated)
              </label>
              <input
                id="cr-topics"
                type="text"
                className="input mono"
                placeholder="rust, actix-web, api"
                value={topicsRaw}
                onChange={(e) => setTopicsRaw(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="cr-init-heading">
        <div className="panel-header">
          <h2 id="cr-init-heading">Initialization &amp; Repository Defaults</h2>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoInit}
              onChange={(e) => setAutoInit(e.target.checked)}
            />
            <span>
              <strong>Initialize with a README commit</strong> (creates default <code>main</code> branch immediately)
            </span>
          </label>

          {autoInit && (
            <div className="grid-2">
              <div className="field">
                <label htmlFor="cr-gitignore" className="field-label">
                  .gitignore Template
                </label>
                <select
                  id="cr-gitignore"
                  className="select"
                  value={gitignoreTemplate}
                  onChange={(e) => setGitignoreTemplate(e.target.value)}
                >
                  <option value="">None</option>
                  {GITIGNORE_TEMPLATES.filter(Boolean).map((tpl) => (
                    <option key={tpl} value={tpl}>
                      {tpl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="cr-license" className="field-label">
                  License
                </label>
                <select
                  id="cr-license"
                  className="select"
                  value={licenseTemplate}
                  onChange={(e) => setLicenseTemplate(e.target.value)}
                >
                  {LICENSE_TEMPLATES.map((lic) => (
                    <option key={lic.value} value={lic.value}>
                      {lic.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid-2" style={{ paddingTop: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasIssues}
                onChange={(e) => setHasIssues(e.target.checked)}
              />
              <span>Enable Issues</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={deleteBranchOnMerge}
                onChange={(e) => setDeleteBranchOnMerge(e.target.checked)}
              />
              <span>Auto-delete head branches after PR merge</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasWiki}
                onChange={(e) => setHasWiki(e.target.checked)}
              />
              <span>Enable Wiki</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasProjects}
                onChange={(e) => setHasProjects(e.target.checked)}
              />
              <span>Enable Projects</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isTemplate}
                onChange={(e) => setIsTemplate(e.target.checked)}
              />
              <span>Mark as Template Repository</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={allowSquash}
                onChange={(e) => setAllowSquash(e.target.checked)}
              />
              <span>Allow Squash Merging</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={allowMergeCommit}
                onChange={(e) => setAllowMergeCommit(e.target.checked)}
              />
              <span>Allow Merge Commits</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={allowRebase}
                onChange={(e) => setAllowRebase(e.target.checked)}
              />
              <span>Allow Rebase Merging</span>
            </label>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn" onClick={() => navigateTo('ledger')}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <FolderPlus size={15} aria-hidden="true" />
          {submitting ? 'Creating on GitHub…' : 'Create Repository'}
        </button>
      </div>
    </form>
  );
};
