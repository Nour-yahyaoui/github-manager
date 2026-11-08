import { DEMO_ORGS, DEMO_USER, demoStore } from './sampleData';
import type {
  AuditEntry,
  AuthStatusResponse,
  BranchSummary,
  BulkActionPayload,
  BulkReposResponse,
  Collaborator,
  ContentEntry,
  CreateRepoInput,
  DecodedReadme,
  GitHubOrg,
  HealthResponse,
  IssueItem,
  ReleaseItem,
  Repository,
  UpdateRepoInput,
  WebhookItem,
} from './types';

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'ERROR') {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  headerToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(headerToken ? { 'X-GitHub-Token': headerToken } : {}),
  };

  const resp = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const raw = await resp.text();
  let parsed: any = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  if (!resp.ok) {
    const errObj = parsed?.error;
    throw new ApiClientError(
      errObj?.message || `Request failed with HTTP ${resp.status}`,
      errObj?.status || resp.status,
      errObj?.code || 'HTTP_ERROR'
    );
  }

  return parsed as T;
}

export function createApiClient(isDemo: boolean, headerToken?: string) {
  return {
    getHealth: async (): Promise<HealthResponse> => {
      if (isDemo) {
        return {
          status: 'ok',
          server: 'demo-workspace',
          version: '0.1.0',
          github_api_base: 'sample://in-memory',
          env_token_present: false,
          session_token_present: false,
          rate_limit: null,
        };
      }
      return requestJson<HealthResponse>('/health', {}, headerToken);
    },

    getAuthStatus: async (): Promise<AuthStatusResponse> => {
      if (isDemo) {
        return {
          authenticated: true,
          token_source: 'demo_workspace',
          masked_token: 'SAMPLE••••DATA',
          user: DEMO_USER,
          rate_limit: {
            limit: 5000,
            remaining: 4992,
            used: 8,
            reset_epoch: Math.floor(Date.now() / 1000) + 3600,
            scopes: ['repo', 'delete_repo', 'admin:repo_hook', 'read:org'],
          },
          scopes: ['repo', 'delete_repo', 'admin:repo_hook', 'read:org'],
          api_base: 'sample://in-memory',
        };
      }
      return requestJson<AuthStatusResponse>('/auth/status', {}, headerToken);
    },

    connectToken: async (token: string): Promise<AuthStatusResponse> =>
      requestJson<AuthStatusResponse>(
        '/auth/token',
        { method: 'POST', body: JSON.stringify({ token }) },
        headerToken
      ),

    disconnectToken: async (): Promise<{ cleared: boolean; env_token_fallback_present: boolean }> =>
      requestJson('/auth/token', { method: 'DELETE' }, headerToken),

    listOrgs: async (): Promise<GitHubOrg[]> => {
      if (isDemo) return DEMO_ORGS;
      return requestJson<GitHubOrg[]>('/orgs', {}, headerToken);
    },

    listRepos: async (): Promise<Repository[]> => {
      if (isDemo) return demoStore.listRepos();
      return requestJson<Repository[]>('/repos?sort=updated&direction=desc', {}, headerToken);
    },

    getRepo: async (owner: string, repo: string): Promise<Repository> => {
      if (isDemo) return demoStore.getRepo(owner, repo);
      return requestJson<Repository>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        {},
        headerToken
      );
    },

    createRepo: async (input: CreateRepoInput): Promise<Repository> => {
      if (isDemo) return demoStore.createRepo(input);
      return requestJson<Repository>(
        '/repos',
        { method: 'POST', body: JSON.stringify(input) },
        headerToken
      );
    },

    updateRepo: async (
      owner: string,
      repo: string,
      patch: UpdateRepoInput
    ): Promise<Repository> => {
      if (isDemo) return demoStore.updateRepo(owner, repo, patch);
      return requestJson<Repository>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        headerToken
      );
    },

    deleteRepo: async (owner: string, repo: string): Promise<void> => {
      if (isDemo) {
        demoStore.deleteRepo(owner, repo);
        return;
      }
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        { method: 'DELETE' },
        headerToken
      );
    },

    replaceTopics: async (
      owner: string,
      repo: string,
      names: string[]
    ): Promise<string[]> => {
      if (isDemo) return demoStore.replaceTopics(owner, repo, names);
      const res = await requestJson<{ names: string[] }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics`,
        { method: 'PUT', body: JSON.stringify({ names }) },
        headerToken
      );
      return res.names;
    },

    transferRepo: async (
      owner: string,
      repo: string,
      new_owner: string
    ): Promise<Repository> => {
      if (isDemo) return demoStore.transferRepo(owner, repo, new_owner);
      return requestJson<Repository>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/transfer`,
        { method: 'POST', body: JSON.stringify({ new_owner }) },
        headerToken
      );
    },

    listBranches: async (owner: string, repo: string): Promise<BranchSummary[]> => {
      if (isDemo) return demoStore.listBranches(owner, repo);
      return requestJson<BranchSummary[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
        {},
        headerToken
      );
    },

    createBranch: async (
      owner: string,
      repo: string,
      branch_name: string,
      from_sha: string
    ): Promise<void> => {
      if (isDemo) {
        demoStore.createBranch(owner, repo, branch_name, from_sha);
        return;
      }
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
        { method: 'POST', body: JSON.stringify({ branch_name, from_sha }) },
        headerToken
      );
    },

    renameBranch: async (
      owner: string,
      repo: string,
      branch: string,
      new_name: string
    ): Promise<BranchSummary> => {
      if (isDemo) return demoStore.renameBranch(owner, repo, branch, new_name);
      return requestJson<BranchSummary>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/rename`,
        { method: 'POST', body: JSON.stringify({ branch, new_name }) },
        headerToken
      );
    },

    deleteBranch: async (owner: string, repo: string, branch: string): Promise<void> => {
      if (isDemo) {
        demoStore.deleteBranch(owner, repo, branch);
        return;
      }
      const encBranch = branch.split('/').map(encodeURIComponent).join('/');
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encBranch}`,
        { method: 'DELETE' },
        headerToken
      );
    },

    getReadme: async (owner: string, repo: string): Promise<DecodedReadme> => {
      if (isDemo) return demoStore.getReadme(owner, repo);
      return requestJson<DecodedReadme>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
        {},
        headerToken
      );
    },

    listRootContents: async (owner: string, repo: string): Promise<ContentEntry[]> => {
      if (isDemo) return demoStore.listRootContents(owner, repo);
      const data = await requestJson<ContentEntry[] | ContentEntry>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`,
        {},
        headerToken
      );
      return Array.isArray(data) ? data : [data];
    },

    putFile: async (
      owner: string,
      repo: string,
      filePath: string,
      input: { message: string; content_utf8: string; sha?: string; branch?: string }
    ): Promise<void> => {
      if (isDemo) {
        demoStore.putReadme(owner, repo, input.content_utf8, input.message);
        return;
      }
      const encPath = filePath.split('/').map(encodeURIComponent).join('/');
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encPath}`,
        { method: 'PUT', body: JSON.stringify(input) },
        headerToken
      );
    },

    listIssues: async (
      owner: string,
      repo: string,
      state = 'open'
    ): Promise<IssueItem[]> => {
      if (isDemo) return demoStore.listIssues(owner, repo, state);
      return requestJson<IssueItem[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${encodeURIComponent(state)}`,
        {},
        headerToken
      );
    },

    createIssue: async (
      owner: string,
      repo: string,
      input: { title: string; body?: string }
    ): Promise<IssueItem> => {
      if (isDemo) return demoStore.createIssue(owner, repo, input.title, input.body);
      return requestJson<IssueItem>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        { method: 'POST', body: JSON.stringify(input) },
        headerToken
      );
    },

    updateIssueState: async (
      owner: string,
      repo: string,
      number: number,
      state: 'open' | 'closed'
    ): Promise<IssueItem> => {
      if (isDemo) return demoStore.updateIssue(owner, repo, number, state);
      return requestJson<IssueItem>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`,
        { method: 'PATCH', body: JSON.stringify({ state }) },
        headerToken
      );
    },

    listReleases: async (owner: string, repo: string): Promise<ReleaseItem[]> => {
      if (isDemo) return demoStore.listReleases(owner, repo);
      return requestJson<ReleaseItem[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`,
        {},
        headerToken
      );
    },

    createRelease: async (
      owner: string,
      repo: string,
      input: {
        tag_name: string;
        target_commitish?: string;
        name?: string;
        body?: string;
        draft?: boolean;
        prerelease?: boolean;
        generate_release_notes?: boolean;
      }
    ): Promise<ReleaseItem> => {
      if (isDemo) return demoStore.createRelease(owner, repo, input);
      return requestJson<ReleaseItem>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`,
        { method: 'POST', body: JSON.stringify(input) },
        headerToken
      );
    },

    deleteRelease: async (
      owner: string,
      repo: string,
      releaseId: number
    ): Promise<void> => {
      if (isDemo) {
        demoStore.deleteRelease(owner, repo, releaseId);
        return;
      }
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${releaseId}`,
        { method: 'DELETE' },
        headerToken
      );
    },

    listCollaborators: async (owner: string, repo: string): Promise<Collaborator[]> => {
      if (isDemo) return demoStore.listCollaborators(owner, repo);
      return requestJson<Collaborator[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators`,
        {},
        headerToken
      );
    },

    addCollaborator: async (
      owner: string,
      repo: string,
      username: string,
      permission: string
    ): Promise<void> => {
      if (isDemo) {
        demoStore.addCollaborator(owner, repo, username, permission);
        return;
      }
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(username)}`,
        { method: 'PUT', body: JSON.stringify({ permission }) },
        headerToken
      );
    },

    removeCollaborator: async (
      owner: string,
      repo: string,
      username: string
    ): Promise<void> => {
      if (isDemo) {
        demoStore.removeCollaborator(owner, repo, username);
        return;
      }
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(username)}`,
        { method: 'DELETE' },
        headerToken
      );
    },

    listWebhooks: async (owner: string, repo: string): Promise<WebhookItem[]> => {
      if (isDemo) return demoStore.listHooks(owner, repo);
      return requestJson<WebhookItem[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`,
        {},
        headerToken
      );
    },

    createWebhook: async (
      owner: string,
      repo: string,
      input: { url: string; content_type?: string; secret?: string; events: string[]; active?: boolean }
    ): Promise<WebhookItem> => {
      if (isDemo) return demoStore.createHook(owner, repo, input.url, input.events);
      return requestJson<WebhookItem>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`,
        { method: 'POST', body: JSON.stringify(input) },
        headerToken
      );
    },

    toggleWebhook: async (
      owner: string,
      repo: string,
      hookId: number,
      active: boolean
    ): Promise<WebhookItem> => {
      if (isDemo) return demoStore.toggleHook(owner, repo, hookId, active);
      return requestJson<WebhookItem>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${hookId}`,
        { method: 'PATCH', body: JSON.stringify({ active }) },
        headerToken
      );
    },

    pingWebhook: async (owner: string, repo: string, hookId: number): Promise<void> => {
      if (isDemo) return;
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${hookId}/pings`,
        { method: 'POST' },
        headerToken
      );
    },

    deleteWebhook: async (owner: string, repo: string, hookId: number): Promise<void> => {
      if (isDemo) {
        demoStore.deleteHook(owner, repo, hookId);
        return;
      }
      await requestJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${hookId}`,
        { method: 'DELETE' },
        headerToken
      );
    },

    executeBulk: async (
      repositories: string[],
      action: BulkActionPayload
    ): Promise<BulkReposResponse> => {
      if (isDemo) return demoStore.bulkExecute(repositories, action);
      return requestJson<BulkReposResponse>(
        '/bulk/repos',
        { method: 'POST', body: JSON.stringify({ repositories, action }) },
        headerToken
      );
    },

    listAudit: async (): Promise<AuditEntry[]> => {
      if (isDemo) return demoStore.getAudits();
      return requestJson<AuditEntry[]>('/audit', {}, headerToken);
    },

    clearAudit: async (): Promise<void> => {
      if (isDemo) {
        demoStore.clearAudits();
        return;
      }
      await requestJson('/audit', { method: 'DELETE' }, headerToken);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
