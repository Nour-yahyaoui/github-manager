import type {
  AuditEntry,
  BranchSummary,
  BulkActionPayload,
  BulkReposResponse,
  Collaborator,
  ContentEntry,
  CreateRepoInput,
  DecodedReadme,
  GitHubOrg,
  GitHubUser,
  IssueItem,
  ReleaseItem,
  Repository,
  UpdateRepoInput,
  WebhookItem,
} from './types';

export const DEMO_USER: GitHubUser = {
  login: 'demo-maintainer',
  id: 9001,
  avatar_url: '',
  html_url: 'https://github.com',
  name: 'Sample Maintainer (Demo)',
  company: 'Local Sample Workspace',
  location: 'Localhost',
  bio: 'Simulated sample workspace for previewing repository workflows without a Personal Access Token.',
  public_repos: 4,
  total_private_repos: 2,
  owned_private_repos: 2,
  followers: 42,
  following: 12,
  created_at: '2023-02-14T10:00:00Z',
};

export const DEMO_ORGS: GitHubOrg[] = [
  {
    login: 'sample-labs',
    id: 9100,
    avatar_url: '',
    description: 'Sample engineering organization (Demo)',
  },
];

const INITIAL_DEMO_REPOS: Repository[] = [
  {
    id: 101,
    name: 'github-manager',
    full_name: 'demo-maintainer/github-manager',
    private: false,
    visibility: 'public',
    owner: {
      login: 'demo-maintainer',
      id: 9001,
      avatar_url: '',
      html_url: 'https://github.com',
      type: 'User',
    },
    html_url: 'https://github.com/alphaa-pixel/github-manager',
    clone_url: 'https://github.com/alphaa-pixel/github-manager.git',
    ssh_url: 'git@github.com:alphaa-pixel/github-manager.git',
    description: 'Local Actix Web control plane for managing GitHub repositories via Personal Access Token.',
    fork: false,
    url: '',
    homepage: 'http://127.0.0.1:8080',
    size: 1840,
    stargazers_count: 38,
    watchers_count: 38,
    language: 'Rust',
    has_issues: true,
    has_projects: false,
    has_downloads: true,
    has_wiki: false,
    has_pages: false,
    has_discussions: true,
    forks_count: 4,
    archived: false,
    disabled: false,
    open_issues_count: 2,
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    allow_forking: true,
    is_template: false,
    topics: ['actix-web', 'rust', 'github-api', 'devtools'],
    default_branch: 'main',
    allow_squash_merge: true,
    allow_merge_commit: true,
    allow_rebase_merge: true,
    allow_auto_merge: false,
    delete_branch_on_merge: true,
    allow_update_branch: true,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
    created_at: '2026-08-12T09:15:00Z',
    updated_at: '2026-11-08T14:20:00Z',
    pushed_at: '2026-11-08T14:18:00Z',
  },
  {
    id: 102,
    name: 'edge-telemetry-rs',
    full_name: 'demo-maintainer/edge-telemetry-rs',
    private: true,
    visibility: 'private',
    owner: {
      login: 'demo-maintainer',
      id: 9001,
      avatar_url: '',
      html_url: 'https://github.com',
      type: 'User',
    },
    html_url: 'https://github.com',
    description: 'Zero-allocation OTLP trace collector and ring-buffer exporter for Linux nodes.',
    fork: false,
    url: '',
    homepage: '',
    size: 4620,
    stargazers_count: 14,
    watchers_count: 14,
    language: 'Rust',
    has_issues: true,
    has_projects: true,
    has_downloads: true,
    has_wiki: true,
    has_pages: false,
    has_discussions: false,
    forks_count: 1,
    archived: false,
    disabled: false,
    open_issues_count: 5,
    license: { key: 'apache-2.0', name: 'Apache License 2.0', spdx_id: 'Apache-2.0' },
    allow_forking: false,
    is_template: false,
    topics: ['observability', 'opentelemetry', 'tokio'],
    default_branch: 'main',
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: true,
    allow_auto_merge: true,
    delete_branch_on_merge: true,
    allow_update_branch: true,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
    created_at: '2026-04-03T11:30:00Z',
    updated_at: '2026-11-06T19:45:00Z',
    pushed_at: '2026-11-06T19:42:00Z',
  },
  {
    id: 103,
    name: 'design-tokens-kit',
    full_name: 'sample-labs/design-tokens-kit',
    private: false,
    visibility: 'public',
    owner: {
      login: 'sample-labs',
      id: 9100,
      avatar_url: '',
      html_url: 'https://github.com',
      type: 'Organization',
    },
    html_url: 'https://github.com',
    description: 'Accessible WCAG 2.2 AA CSS token generator and starter template for internal dashboards.',
    fork: false,
    url: '',
    homepage: 'https://example.org/tokens',
    size: 980,
    stargazers_count: 91,
    watchers_count: 91,
    language: 'TypeScript',
    has_issues: true,
    has_projects: false,
    has_downloads: true,
    has_wiki: false,
    has_pages: true,
    has_discussions: true,
    forks_count: 11,
    archived: false,
    disabled: false,
    open_issues_count: 1,
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    allow_forking: true,
    is_template: true,
    topics: ['design-system', 'accessibility', 'css-tokens', 'template'],
    default_branch: 'main',
    allow_squash_merge: true,
    allow_merge_commit: true,
    allow_rebase_merge: false,
    allow_auto_merge: true,
    delete_branch_on_merge: true,
    allow_update_branch: true,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
    created_at: '2025-11-18T16:10:00Z',
    updated_at: '2026-11-02T08:12:00Z',
    pushed_at: '2026-11-02T08:10:00Z',
  },
  {
    id: 104,
    name: 'infra-terraform-modules',
    full_name: 'demo-maintainer/infra-terraform-modules',
    private: true,
    visibility: 'private',
    owner: {
      login: 'demo-maintainer',
      id: 9001,
      avatar_url: '',
      html_url: 'https://github.com',
      type: 'User',
    },
    html_url: 'https://github.com',
    description: 'Hardened VPC, WireGuard bastion, and PostgreSQL backup modules.',
    fork: false,
    url: '',
    homepage: '',
    size: 1320,
    stargazers_count: 3,
    watchers_count: 3,
    language: 'HCL',
    has_issues: true,
    has_projects: false,
    has_downloads: true,
    has_wiki: false,
    has_pages: false,
    has_discussions: false,
    forks_count: 0,
    archived: false,
    disabled: false,
    open_issues_count: 0,
    license: null,
    allow_forking: false,
    is_template: false,
    topics: ['terraform', 'infrastructure', 'security'],
    default_branch: 'main',
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: true,
    allow_auto_merge: false,
    delete_branch_on_merge: true,
    allow_update_branch: true,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
    created_at: '2025-09-09T12:00:00Z',
    updated_at: '2026-10-21T15:05:00Z',
    pushed_at: '2026-10-21T15:00:00Z',
  },
  {
    id: 105,
    name: 'legacy-webhook-relay',
    full_name: 'demo-maintainer/legacy-webhook-relay',
    private: false,
    visibility: 'public',
    owner: {
      login: 'demo-maintainer',
      id: 9001,
      avatar_url: '',
      html_url: 'https://github.com',
      type: 'User',
    },
    html_url: 'https://github.com',
    description: 'Deprecated Node 16 webhook forwarder superseded by github-manager.',
    fork: false,
    url: '',
    homepage: '',
    size: 540,
    stargazers_count: 7,
    watchers_count: 7,
    language: 'JavaScript',
    has_issues: false,
    has_projects: false,
    has_downloads: true,
    has_wiki: false,
    has_pages: false,
    has_discussions: false,
    forks_count: 2,
    archived: true,
    disabled: false,
    open_issues_count: 0,
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    allow_forking: true,
    is_template: false,
    topics: ['archived', 'webhooks'],
    default_branch: 'master',
    allow_squash_merge: true,
    allow_merge_commit: true,
    allow_rebase_merge: true,
    allow_auto_merge: false,
    delete_branch_on_merge: false,
    allow_update_branch: false,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
    created_at: '2022-05-01T08:00:00Z',
    updated_at: '2025-01-10T10:00:00Z',
    pushed_at: '2024-12-18T10:00:00Z',
  },
  {
    id: 106,
    name: 'serde-json-path',
    full_name: 'demo-maintainer/serde-json-path',
    private: false,
    visibility: 'public',
    owner: {
      login: 'demo-maintainer',
      id: 9001,
      avatar_url: '',
      html_url: 'https://github.com',
      type: 'User',
    },
    html_url: 'https://github.com',
    description: 'Fork with RFC 9535 filter expression benchmarks.',
    fork: true,
    url: '',
    homepage: '',
    size: 2150,
    stargazers_count: 2,
    watchers_count: 2,
    language: 'Rust',
    has_issues: false,
    has_projects: false,
    has_downloads: true,
    has_wiki: false,
    has_pages: false,
    has_discussions: false,
    forks_count: 0,
    archived: false,
    disabled: false,
    open_issues_count: 0,
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    allow_forking: true,
    is_template: false,
    topics: ['serde', 'jsonpath'],
    default_branch: 'main',
    allow_squash_merge: true,
    allow_merge_commit: true,
    allow_rebase_merge: true,
    allow_auto_merge: false,
    delete_branch_on_merge: true,
    allow_update_branch: true,
    permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
    created_at: '2026-06-20T14:20:00Z',
    updated_at: '2026-09-14T11:00:00Z',
    pushed_at: '2026-09-14T11:00:00Z',
  },
];

export class DemoStore {
  private repos: Repository[] = structuredClone(INITIAL_DEMO_REPOS);
  private branches = new Map<string, BranchSummary[]>();
  private readmes = new Map<string, string>();
  private issues = new Map<string, IssueItem[]>();
  private releases = new Map<string, ReleaseItem[]>();
  private collabs = new Map<string, Collaborator[]>();
  private hooks = new Map<string, WebhookItem[]>();
  private audits: AuditEntry[] = [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      action: 'demo.init',
      target: 'Sample Workspace',
      status: 'info',
      detail: 'Loaded in-memory sample repositories (Demo Data)',
    },
  ];
  private seq = 500;

  constructor() {
    for (const r of this.repos) {
      this.ensureDefaults(r);
    }
  }

  private ensureDefaults(repo: Repository) {
    if (!this.branches.has(repo.full_name)) {
      this.branches.set(repo.full_name, [
        {
          name: repo.default_branch,
          commit: { sha: 'c54312b79cff2de24a9d14a64987c703465146cd', url: '' },
          protected: true,
        },
        {
          name: 'feat/batch-operations',
          commit: { sha: '8f91bc042e77a3190f1244d8a1bc9021aa77e310', url: '' },
          protected: false,
        },
      ]);
    }
    if (!this.readmes.has(repo.full_name)) {
      this.readmes.set(
        repo.full_name,
        `# ${repo.name}\n\n${repo.description || 'Sample repository README.'}\n\n> **Note:** You are viewing simulated Demo Data in the Sample Workspace.`
      );
    }
    if (!this.issues.has(repo.full_name)) {
      this.issues.set(
        repo.full_name,
        repo.open_issues_count > 0
          ? [
              {
                id: this.seq++,
                number: 1,
                title: 'Add fine-grained PAT scope diagnostics in status drawer',
                state: 'open',
                body: 'Verify X-OAuth-Scopes vs fine-grained repository permissions.',
                html_url: 'https://github.com',
                user: repo.owner,
                labels: [{ name: 'enhancement', color: '1d4ed8' }],
                comments: 2,
                created_at: '2026-11-05T10:00:00Z',
                updated_at: '2026-11-07T16:30:00Z',
              },
            ]
          : []
      );
    }
    if (!this.releases.has(repo.full_name)) {
      this.releases.set(repo.full_name, [
        {
          id: this.seq++,
          tag_name: 'v0.1.0',
          target_commitish: repo.default_branch,
          name: 'v0.1.0 — Initial Local Release',
          body: 'Initial Actix Web local control plane with repository ledger and batch mutations.',
          draft: false,
          prerelease: false,
          html_url: 'https://github.com',
          created_at: '2026-10-30T12:00:00Z',
          published_at: '2026-10-30T12:05:00Z',
          author: repo.owner,
        },
      ]);
    }
    if (!this.collabs.has(repo.full_name)) {
      this.collabs.set(repo.full_name, [
        {
          login: repo.owner.login,
          id: repo.owner.id,
          avatar_url: '',
          html_url: 'https://github.com',
          role_name: 'admin',
          permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
        },
      ]);
    }
    if (!this.hooks.has(repo.full_name)) {
      this.hooks.set(repo.full_name, []);
    }
  }

  private log(action: string, target: string, detail: string) {
    this.audits.unshift({
      id: this.seq++,
      timestamp: new Date().toISOString(),
      action,
      target,
      status: 'demo',
      detail: `[Demo] ${detail}`,
    });
  }

  listRepos(): Repository[] {
    return structuredClone(this.repos);
  }

  getRepo(owner: string, repo: string): Repository {
    const found = this.repos.find((r) => r.owner.login === owner && r.name === repo);
    if (!found) throw new Error(`Sample repository ${owner}/${repo} not found.`);
    return structuredClone(found);
  }

  createRepo(input: CreateRepoInput): Repository {
    const ownerLogin = input.org?.trim() || DEMO_USER.login;
    const isPrivate = input.visibility ? input.visibility === 'private' : Boolean(input.private);
    const created: Repository = {
      id: this.seq++,
      name: input.name.trim(),
      full_name: `${ownerLogin}/${input.name.trim()}`,
      private: isPrivate,
      visibility: isPrivate ? 'private' : 'public',
      owner: {
        login: ownerLogin,
        id: ownerLogin === DEMO_USER.login ? DEMO_USER.id : 9100,
        avatar_url: '',
        html_url: 'https://github.com',
        type: ownerLogin === DEMO_USER.login ? 'User' : 'Organization',
      },
      html_url: 'https://github.com',
      description: input.description || '',
      fork: false,
      url: '',
      homepage: input.homepage || '',
      size: input.auto_init ? 12 : 0,
      stargazers_count: 0,
      watchers_count: 0,
      language: null,
      has_issues: input.has_issues ?? true,
      has_projects: input.has_projects ?? false,
      has_downloads: true,
      has_wiki: input.has_wiki ?? false,
      has_pages: false,
      has_discussions: input.has_discussions ?? false,
      forks_count: 0,
      archived: false,
      disabled: false,
      open_issues_count: 0,
      license: input.license_template
        ? { key: input.license_template, name: input.license_template.toUpperCase(), spdx_id: input.license_template.toUpperCase() }
        : null,
      allow_forking: true,
      is_template: input.is_template ?? false,
      topics: [],
      default_branch: 'main',
      allow_squash_merge: input.allow_squash_merge ?? true,
      allow_merge_commit: input.allow_merge_commit ?? true,
      allow_rebase_merge: input.allow_rebase_merge ?? true,
      allow_auto_merge: input.allow_auto_merge ?? false,
      delete_branch_on_merge: input.delete_branch_on_merge ?? true,
      allow_update_branch: true,
      permissions: { admin: true, maintain: true, push: true, triage: true, pull: true },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pushed_at: new Date().toISOString(),
    };
    this.repos.unshift(created);
    this.ensureDefaults(created);
    this.log('repo.create', created.full_name, `Created ${created.visibility} sample repository`);
    return structuredClone(created);
  }

  updateRepo(owner: string, repo: string, patch: UpdateRepoInput): Repository {
    const idx = this.repos.findIndex((r) => r.owner.login === owner && r.name === repo);
    if (idx === -1) throw new Error(`Sample repository ${owner}/${repo} not found.`);
    const prev = this.repos[idx];
    const oldFull = prev.full_name;
    const nextName = patch.name?.trim() || prev.name;
    const nextVis =
      patch.visibility ?? (patch.private !== undefined ? (patch.private ? 'private' : 'public') : prev.visibility || 'public');

    const updated: Repository = {
      ...prev,
      ...patch,
      name: nextName,
      full_name: `${prev.owner.login}/${nextName}`,
      private: nextVis === 'private',
      visibility: nextVis,
      updated_at: new Date().toISOString(),
    };
    this.repos[idx] = updated;

    if (oldFull !== updated.full_name) {
      for (const map of [this.branches, this.readmes, this.issues, this.releases, this.collabs, this.hooks] as Array<Map<string, any>>) {
        if (map.has(oldFull)) {
          const val = map.get(oldFull);
          map.delete(oldFull);
          map.set(updated.full_name, val);
        }
      }
    }
    this.log('repo.update', updated.full_name, 'Updated sample repository settings');
    return structuredClone(updated);
  }

  replaceTopics(owner: string, repo: string, names: string[]): string[] {
    const idx = this.repos.findIndex((r) => r.owner.login === owner && r.name === repo);
    if (idx === -1) throw new Error('Sample repository not found.');
    const clean = Array.from(
      new Set(
        names
          .map((n) => n.trim().toLowerCase().replace(/\s+/g, '-'))
          .filter(Boolean)
      )
    );
    this.repos[idx].topics = clean;
    this.repos[idx].updated_at = new Date().toISOString();
    this.log('repo.topics', this.repos[idx].full_name, `Set topics: ${clean.join(', ') || '(none)'}`);
    return [...clean];
  }

  deleteRepo(owner: string, repo: string): void {
    const full = `${owner}/${repo}`;
    this.repos = this.repos.filter((r) => r.full_name !== full);
    this.log('repo.delete', full, 'Deleted sample repository');
  }

  transferRepo(owner: string, repo: string, newOwner: string): Repository {
    const idx = this.repos.findIndex((r) => r.owner.login === owner && r.name === repo);
    if (idx === -1) throw new Error('Sample repository not found.');
    const target = this.repos[idx];
    const cleanOwner = newOwner.trim();
    const updated: Repository = {
      ...target,
      owner: { ...target.owner, login: cleanOwner },
      full_name: `${cleanOwner}/${target.name}`,
      updated_at: new Date().toISOString(),
    };
    this.repos[idx] = updated;
    this.ensureDefaults(updated);
    this.log('repo.transfer', updated.full_name, `Transferred from @${owner} to @${cleanOwner}`);
    return structuredClone(updated);
  }

  listBranches(owner: string, repo: string): BranchSummary[] {
    return structuredClone(this.branches.get(`${owner}/${repo}`) || []);
  }

  createBranch(owner: string, repo: string, branchName: string, fromSha: string): void {
    const key = `${owner}/${repo}`;
    const list = this.branches.get(key) || [];
    list.push({
      name: branchName.trim(),
      commit: { sha: fromSha, url: '' },
      protected: false,
    });
    this.branches.set(key, list);
    this.log('branch.create', key, `Created branch ${branchName.trim()}`);
  }

  renameBranch(owner: string, repo: string, branch: string, newName: string): BranchSummary {
    const key = `${owner}/${repo}`;
    const list = this.branches.get(key) || [];
    const found = list.find((b) => b.name === branch);
    if (!found) throw new Error(`Branch ${branch} not found.`);
    found.name = newName.trim();
    this.log('branch.rename', key, `Renamed branch ${branch} -> ${newName.trim()}`);
    return structuredClone(found);
  }

  deleteBranch(owner: string, repo: string, branch: string): void {
    const key = `${owner}/${repo}`;
    this.branches.set(
      key,
      (this.branches.get(key) || []).filter((b) => b.name !== branch)
    );
    this.log('branch.delete', key, `Deleted branch ${branch}`);
  }

  getReadme(owner: string, repo: string): DecodedReadme {
    const key = `${owner}/${repo}`;
    const content = this.readmes.get(key) || `# ${repo}\n`;
    return {
      name: 'README.md',
      path: 'README.md',
      sha: 'demo-readme-sha-001',
      size: content.length,
      html_url: 'https://github.com',
      decoded_content: content,
    };
  }

  listRootContents(owner: string, repo: string): ContentEntry[] {
    const rd = this.getReadme(owner, repo);
    return [
      { name: 'src', path: 'src', sha: 'sha-dir-1', size: 0, type: 'dir' },
      { name: 'Cargo.toml', path: 'Cargo.toml', sha: 'sha-file-1', size: 612, type: 'file' },
      { name: 'README.md', path: 'README.md', sha: rd.sha, size: rd.size, type: 'file' },
    ];
  }

  putReadme(owner: string, repo: string, content: string, message: string): void {
    const key = `${owner}/${repo}`;
    this.readmes.set(key, content);
    this.log('content.commit', key, `Committed README.md (${message})`);
  }

  listIssues(owner: string, repo: string, state: string): IssueItem[] {
    const all = this.issues.get(`${owner}/${repo}`) || [];
    if (state === 'all') return structuredClone(all);
    return structuredClone(all.filter((i) => i.state === state));
  }

  createIssue(owner: string, repo: string, title: string, body?: string): IssueItem {
    const key = `${owner}/${repo}`;
    const list = this.issues.get(key) || [];
    const created: IssueItem = {
      id: this.seq++,
      number: list.length + 1,
      title,
      body: body || '',
      state: 'open',
      html_url: 'https://github.com',
      user: {
        login: DEMO_USER.login,
        id: DEMO_USER.id,
        avatar_url: DEMO_USER.avatar_url,
        html_url: DEMO_USER.html_url,
        type: 'User',
      },
      labels: [],
      comments: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(created);
    this.issues.set(key, list);
    this.log('issue.create', `${key}#${created.number}`, `Opened issue: ${title}`);
    return structuredClone(created);
  }

  updateIssue(owner: string, repo: string, num: number, state: string): IssueItem {
    const key = `${owner}/${repo}`;
    const list = this.issues.get(key) || [];
    const found = list.find((i) => i.number === num);
    if (!found) throw new Error('Issue not found.');
    found.state = state;
    found.updated_at = new Date().toISOString();
    this.log('issue.update', `${key}#${num}`, `State -> ${state}`);
    return structuredClone(found);
  }

  listReleases(owner: string, repo: string): ReleaseItem[] {
    return structuredClone(this.releases.get(`${owner}/${repo}`) || []);
  }

  createRelease(
    owner: string,
    repo: string,
    input: { tag_name: string; target_commitish?: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean }
  ): ReleaseItem {
    const key = `${owner}/${repo}`;
    const list = this.releases.get(key) || [];
    const rel: ReleaseItem = {
      id: this.seq++,
      tag_name: input.tag_name,
      target_commitish: input.target_commitish || 'main',
      name: input.name || input.tag_name,
      body: input.body || '',
      draft: Boolean(input.draft),
      prerelease: Boolean(input.prerelease),
      html_url: 'https://github.com',
      created_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      author: {
        login: DEMO_USER.login,
        id: DEMO_USER.id,
        avatar_url: DEMO_USER.avatar_url,
        html_url: DEMO_USER.html_url,
        type: 'User',
      },
    };
    list.unshift(rel);
    this.releases.set(key, list);
    this.log('release.create', key, `Published ${rel.tag_name}`);
    return structuredClone(rel);
  }

  deleteRelease(owner: string, repo: string, id: number): void {
    const key = `${owner}/${repo}`;
    this.releases.set(
      key,
      (this.releases.get(key) || []).filter((r) => r.id !== id)
    );
    this.log('release.delete', key, `Deleted release #${id}`);
  }

  listCollaborators(owner: string, repo: string): Collaborator[] {
    return structuredClone(this.collabs.get(`${owner}/${repo}`) || []);
  }

  addCollaborator(owner: string, repo: string, username: string, permission: string): void {
    const key = `${owner}/${repo}`;
    const list = this.collabs.get(key) || [];
    const existing = list.find((c) => c.login.toLowerCase() === username.toLowerCase());
    if (existing) {
      existing.role_name = permission;
    } else {
      list.push({
        login: username,
        id: this.seq++,
        avatar_url: '',
        html_url: 'https://github.com',
        role_name: permission,
      });
    }
    this.collabs.set(key, list);
    this.log('collaborator.add', key, `Added @${username} (${permission})`);
  }

  removeCollaborator(owner: string, repo: string, username: string): void {
    const key = `${owner}/${repo}`;
    this.collabs.set(
      key,
      (this.collabs.get(key) || []).filter((c) => c.login !== username)
    );
    this.log('collaborator.remove', key, `Removed @${username}`);
  }

  listHooks(owner: string, repo: string): WebhookItem[] {
    return structuredClone(this.hooks.get(`${owner}/${repo}`) || []);
  }

  createHook(owner: string, repo: string, url: string, events: string[]): WebhookItem {
    const key = `${owner}/${repo}`;
    const list = this.hooks.get(key) || [];
    const hook: WebhookItem = {
      id: this.seq++,
      name: 'web',
      active: true,
      events: events.length ? events : ['push'],
      config: { url, content_type: 'json' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(hook);
    this.hooks.set(key, list);
    this.log('webhook.create', key, `Registered webhook -> ${url}`);
    return structuredClone(hook);
  }

  toggleHook(owner: string, repo: string, id: number, active: boolean): WebhookItem {
    const key = `${owner}/${repo}`;
    const list = this.hooks.get(key) || [];
    const found = list.find((h) => h.id === id);
    if (!found) throw new Error('Webhook not found');
    found.active = active;
    this.log('webhook.update', key, `Webhook #${id} active=${active}`);
    return structuredClone(found);
  }

  deleteHook(owner: string, repo: string, id: number): void {
    const key = `${owner}/${repo}`;
    this.hooks.set(
      key,
      (this.hooks.get(key) || []).filter((h) => h.id !== id)
    );
    this.log('webhook.delete', key, `Deleted webhook #${id}`);
  }

  bulkExecute(repositories: string[], action: BulkActionPayload): BulkReposResponse {
    const results = repositories.map((full_name) => {
      const [owner, repo] = full_name.split('/');
      try {
        if (action.kind === 'set_visibility') {
          this.updateRepo(owner, repo, { visibility: action.visibility, private: action.visibility === 'private' });
          return { full_name, ok: true, message: `Visibility -> ${action.visibility}` };
        }
        if (action.kind === 'set_archived') {
          this.updateRepo(owner, repo, { archived: action.archived });
          return { full_name, ok: true, message: action.archived ? 'Archived' : 'Unarchived' };
        }
        if (action.kind === 'update_features') {
          this.updateRepo(owner, repo, {
            has_issues: action.has_issues,
            has_wiki: action.has_wiki,
            has_projects: action.has_projects,
            delete_branch_on_merge: action.delete_branch_on_merge,
            allow_auto_merge: action.allow_auto_merge,
          });
          return { full_name, ok: true, message: 'Updated repository policies' };
        }
        if (action.kind === 'add_topics') {
          const cur = this.getRepo(owner, repo).topics;
          this.replaceTopics(owner, repo, [...cur, ...action.topics]);
          return { full_name, ok: true, message: 'Added topics' };
        }
        if (action.kind === 'replace_topics') {
          this.replaceTopics(owner, repo, action.topics);
          return { full_name, ok: true, message: 'Replaced topics' };
        }
        if (action.kind === 'delete_repositories') {
          if (action.confirm_phrase !== 'DELETE SELECTED') {
            throw new Error("Type 'DELETE SELECTED' to confirm.");
          }
          this.deleteRepo(owner, repo);
          return { full_name, ok: true, message: 'Deleted repository' };
        }
        return { full_name, ok: false, message: 'Unknown action' };
      } catch (e: any) {
        return { full_name, ok: false, message: e?.message || 'Failed' };
      }
    });

    const succeeded = results.filter((r) => r.ok).length;
    return {
      total: repositories.length,
      succeeded,
      failed: repositories.length - succeeded,
      results,
    };
  }

  getAudits(): AuditEntry[] {
    return structuredClone(this.audits);
  }

  clearAudits(): void {
    this.audits = [];
  }
}

export const demoStore = new DemoStore();
