import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type ApiClient, createApiClient } from '../api/client';
import type {
  AuditEntry,
  AuthStatusResponse,
  GitHubOrg,
  HealthResponse,
  Repository,
} from '../api/types';

export type NavSection = 'ledger' | 'create' | 'batch' | 'audit' | 'token' | 'repo-detail';

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

interface AppContextValue {
  api: ApiClient;
  isDemo: boolean;
  enterDemoWorkspace: () => Promise<void>;
  exitDemoWorkspace: () => Promise<void>;
  health: HealthResponse | null;
  auth: AuthStatusResponse | null;
  authLoading: boolean;
  authError: string | null;
  repos: Repository[];
  reposLoading: boolean;
  reposError: string | null;
  orgs: GitHubOrg[];
  auditEntries: AuditEntry[];
  selectedFullNames: string[];
  toggleSelectRepo: (fullName: string) => void;
  setSelectedFullNames: React.Dispatch<React.SetStateAction<string[]>>;
  section: NavSection;
  activeRepoSlug: { owner: string; repo: string } | null;
  navigateTo: (sec: NavSection, slug?: { owner: string; repo: string } | null) => void;
  refreshAll: () => Promise<void>;
  refreshRepos: () => Promise<void>;
  refreshAudit: () => Promise<void>;
  connectPat: (token: string) => Promise<void>;
  disconnectPat: () => Promise<void>;
  upsertRepoInList: (updated: Repository, previousFullName?: string) => void;
  removeRepoFromList: (fullName: string) => void;
  toasts: ToastMessage[];
  pushToast: (kind: ToastMessage['kind'], text: string) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastSeq = 1;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemo, setIsDemo] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [auth, setAuth] = useState<AuthStatusResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [repos, setRepos] = useState<Repository[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<GitHubOrg[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [selectedFullNames, setSelectedFullNames] = useState<string[]>([]);

  const [section, setSection] = useState<NavSection>('ledger');
  const [activeRepoSlug, setActiveRepoSlug] = useState<{ owner: string; repo: string } | null>(
    null
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const api = useMemo(() => createApiClient(isDemo), [isDemo]);

  const pushToast = useCallback((kind: ToastMessage['kind'], text: string) => {
    const id = toastSeq++;
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4800);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const navigateTo = useCallback(
    (sec: NavSection, slug?: { owner: string; repo: string } | null) => {
      setSection(sec);
      if (sec === 'repo-detail' && slug) {
        setActiveRepoSlug(slug);
      } else if (sec !== 'repo-detail') {
        setActiveRepoSlug(null);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    []
  );

  const refreshAudit = useCallback(async () => {
    try {
      const entries = await api.listAudit();
      setAuditEntries(entries);
    } catch {
      /* ignore non-critical audit error */
    }
  }, [api]);

  const refreshRepos = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    try {
      const [repoList, orgList] = await Promise.all([
        api.listRepos(),
        api.listOrgs().catch(() => [] as GitHubOrg[]),
      ]);
      setRepos(repoList);
      setOrgs(orgList);
    } catch (err: any) {
      setReposError(err?.message || 'Unable to load repositories.');
    } finally {
      setReposLoading(false);
    }
  }, [api]);

  const refreshAll = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const [h, status] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getAuthStatus(),
      ]);
      setHealth(h);
      setAuth(status);

      if (status.authenticated) {
        await Promise.all([refreshRepos(), refreshAudit()]);
      } else {
        setRepos([]);
        setOrgs([]);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to check GitHub authentication status.');
      setAuth({
        authenticated: false,
        token_source: 'none',
        scopes: [],
        api_base: 'https://api.github.com',
      });
    } finally {
      setAuthLoading(false);
    }
  }, [api, refreshRepos, refreshAudit]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const connectPat = useCallback(
    async (token: string) => {
      const liveClient = createApiClient(false);
      const status = await liveClient.connectToken(token);
      setIsDemo(false);
      setAuth(status);
      setAuthError(null);
      const [repoList, orgList, h, audits] = await Promise.all([
        liveClient.listRepos(),
        liveClient.listOrgs().catch(() => []),
        liveClient.getHealth().catch(() => null),
        liveClient.listAudit().catch(() => []),
      ]);
      setRepos(repoList);
      setOrgs(orgList);
      setHealth(h);
      setAuditEntries(audits);
      setSelectedFullNames([]);
      pushToast('success', `Authenticated as @${status.user?.login}`);
      setSection('ledger');
    },
    [pushToast]
  );

  const disconnectPat = useCallback(async () => {
    const liveClient = createApiClient(false);
    await liveClient.disconnectToken();
    setIsDemo(false);
    setSelectedFullNames([]);
    await refreshAll();
    pushToast('info', 'Cleared runtime session token.');
  }, [refreshAll, pushToast]);

  const enterDemoWorkspace = useCallback(async () => {
    setIsDemo(true);
    setSelectedFullNames([]);
    setSection('ledger');
    pushToast('info', 'Entered Sample Workspace (Demo Data).');
  }, [pushToast]);

  const exitDemoWorkspace = useCallback(async () => {
    setIsDemo(false);
    setSelectedFullNames([]);
    setSection('token');
  }, []);

  const toggleSelectRepo = useCallback((fullName: string) => {
    setSelectedFullNames((prev) =>
      prev.includes(fullName) ? prev.filter((n) => n !== fullName) : [...prev, fullName]
    );
  }, []);

  const upsertRepoInList = useCallback((updated: Repository, previousFullName?: string) => {
    setRepos((prev) => {
      const matchKey = previousFullName || updated.full_name;
      const exists = prev.some((r) => r.full_name === matchKey || r.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map((r) => (r.full_name === matchKey || r.id === updated.id ? updated : r));
    });
    if (previousFullName && previousFullName !== updated.full_name) {
      setSelectedFullNames((prev) =>
        prev.map((n) => (n === previousFullName ? updated.full_name : n))
      );
      setActiveRepoSlug((cur) =>
        cur && `${cur.owner}/${cur.repo}` === previousFullName
          ? { owner: updated.owner.login, repo: updated.name }
          : cur
      );
    }
  }, []);

  const removeRepoFromList = useCallback((fullName: string) => {
    setRepos((prev) => prev.filter((r) => r.full_name !== fullName));
    setSelectedFullNames((prev) => prev.filter((n) => n !== fullName));
  }, []);

  return (
    <AppContext.Provider
      value={{
        api,
        isDemo,
        enterDemoWorkspace,
        exitDemoWorkspace,
        health,
        auth,
        authLoading,
        authError,
        repos,
        reposLoading,
        reposError,
        orgs,
        auditEntries,
        selectedFullNames,
        toggleSelectRepo,
        setSelectedFullNames,
        section,
        activeRepoSlug,
        navigateTo,
        refreshAll,
        refreshRepos,
        refreshAudit,
        connectPat,
        disconnectPat,
        upsertRepoInList,
        removeRepoFromList,
        toasts,
        pushToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
