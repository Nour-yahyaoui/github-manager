export interface RateLimitSnapshot {
  limit: number;
  remaining: number;
  used: number;
  reset_epoch: number;
  scopes: string[];
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name?: string | null;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
  public_repos: number;
  total_private_repos?: number | null;
  owned_private_repos?: number | null;
  followers: number;
  following: number;
  created_at?: string | null;
}

export interface GitHubOrg {
  login: string;
  id: number;
  avatar_url: string;
  description?: string | null;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  token_source: string;
  masked_token?: string | null;
  user?: GitHubUser | null;
  rate_limit?: RateLimitSnapshot | null;
  scopes: string[];
  api_base: string;
}

export interface HealthResponse {
  status: string;
  server: string;
  version: string;
  github_api_base: string;
  env_token_present: boolean;
  session_token_present: boolean;
  rate_limit?: RateLimitSnapshot | null;
}

export interface RepoOwner {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
}

export interface RepoLicense {
  key: string;
  name: string;
  spdx_id?: string | null;
}

export interface RepoPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  visibility?: string | null;
  owner: RepoOwner;
  html_url: string;
  clone_url?: string | null;
  ssh_url?: string | null;
  description?: string | null;
  fork: boolean;
  url: string;
  homepage?: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language?: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license?: RepoLicense | null;
  allow_forking?: boolean | null;
  is_template: boolean;
  topics: string[];
  default_branch: string;
  allow_squash_merge?: boolean | null;
  allow_merge_commit?: boolean | null;
  allow_rebase_merge?: boolean | null;
  allow_auto_merge?: boolean | null;
  delete_branch_on_merge?: boolean | null;
  allow_update_branch?: boolean | null;
  permissions?: RepoPermissions | null;
  created_at?: string | null;
  updated_at?: string | null;
  pushed_at?: string | null;
}

export interface CreateRepoInput {
  name: string;
  org?: string;
  description?: string;
  homepage?: string;
  private?: boolean;
  visibility?: 'public' | 'private';
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  has_discussions?: boolean;
  is_template?: boolean;
  auto_init?: boolean;
  gitignore_template?: string;
  license_template?: string;
  allow_squash_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
}

export interface UpdateRepoInput {
  name?: string;
  description?: string;
  homepage?: string;
  private?: boolean;
  visibility?: 'public' | 'private';
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  has_discussions?: boolean;
  is_template?: boolean;
  default_branch?: string;
  allow_squash_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  allow_update_branch?: boolean;
  archived?: boolean;
}

export interface BranchSummary {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface ContentEntry {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  html_url?: string | null;
  download_url?: string | null;
}

export interface DecodedReadme {
  name: string;
  path: string;
  sha: string;
  size: number;
  html_url?: string | null;
  decoded_content: string;
}

export interface IssueLabel {
  id?: number;
  name: string;
  color: string;
  description?: string | null;
}

export interface IssueItem {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | string;
  body?: string | null;
  html_url: string;
  user?: RepoOwner | null;
  labels: IssueLabel[];
  comments: number;
  pull_request?: { html_url?: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ReleaseItem {
  id: number;
  tag_name: string;
  target_commitish: string;
  name?: string | null;
  body?: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  created_at?: string | null;
  published_at?: string | null;
  author?: RepoOwner | null;
}

export interface Collaborator {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  role_name?: string | null;
  permissions?: RepoPermissions | null;
}

export interface WebhookItem {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: {
    url?: string;
    content_type?: string;
    insecure_ssl?: string;
  };
  created_at?: string | null;
  updated_at?: string | null;
}

export type BulkActionPayload =
  | { kind: 'set_visibility'; visibility: 'public' | 'private' }
  | { kind: 'set_archived'; archived: boolean }
  | {
      kind: 'update_features';
      has_issues?: boolean;
      has_wiki?: boolean;
      has_projects?: boolean;
      delete_branch_on_merge?: boolean;
      allow_auto_merge?: boolean;
    }
  | { kind: 'add_topics'; topics: string[] }
  | { kind: 'replace_topics'; topics: string[] }
  | { kind: 'delete_repositories'; confirm_phrase: string };

export interface BulkRepoResult {
  full_name: string;
  ok: boolean;
  message: string;
}

export interface BulkReposResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkRepoResult[];
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  action: string;
  target: string;
  status: string;
  detail: string;
}

export interface ConnectivityTcpCheck {
  address: string;
  ok: boolean;
  ms?: number;
  error?: string;
}

export interface ConnectivityReport {
  ok: boolean;
  verdict: string;
  message?: string;
  api_base: string;
  host?: string;
  port?: number;
  token_present?: boolean;
  proxy: {
    mode: string;
    description?: string;
    env_vars: string[];
  };
  dns: {
    ok: boolean;
    addresses: string[];
    error?: string | null;
  };
  tcp: ConnectivityTcpCheck[];
  https: {
    ok: boolean;
    status?: number;
    ms?: number;
    url?: string;
    error?: string | null;
    hint?: string | null;
    via_system_ca?: boolean;
  };
}
