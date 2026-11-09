import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type ApiClient, createApiClient } from '../api/client';
import type {
  AuditEntry,
  AuthStatusResponse,
  GitHubOrg,
  HealthResponse,
  Repository,
} from '../api/types';

export type NavSection = 'ledger' | 'create' | 'batch' | 'audit' | 'token' | 'repo-detail';

export interface AccountSummary { id: string; login: string; name?: string | null; source: 'server' | 'session'; }
interface SessionAccount extends AccountSummary { token?: string; }

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

interface AppContextValue {
  api: ApiClient;
  accounts: AccountSummary[];
  activeAccountId: string | null;
  switchAccount: (id: string) => void;
  removeAccount: (id: string) => void;
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
  const [accounts, setAccounts] = useState<SessionAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>('server');
  const generation = useRef(0);
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

  const activeToken = accounts.find((account) => account.id === activeAccountId)?.token;
  const api = useMemo(() => createApiClient(isDemo, activeToken), [isDemo, activeToken, activeAccountId]);
  const currentGeneration = generation.current;

  const resetWorkspace = () => {
    generation.current += 1;
    setAuthLoading(true);
    setAuth(null);
    setAuthError(null);
    setReposError(null);
    setReposLoading(false);
    setRepos([]);
    setOrgs([]);
    setAuditEntries([]);
    setSelectedFullNames([]);
    setActiveRepoSlug(null);
    setSection('ledger');
  };

  const switchAccount = useCallback((id: string) => {
    if (!accounts.some((account) => account.id === id) || (!isDemo && id === activeAccountId)) return;
    resetWorkspace();
    setIsDemo(false);
    setActiveAccountId(id);
  }, [accounts, activeAccountId, isDemo]);

  const removeAccount = useCallback((id: string) => {
    const account = accounts.find((item) => item.id === id);
    if (!account || account.source === 'server') return;
    const remaining = accounts.filter((item) => item.id !== id);
    setAccounts(remaining);
    if (!isDemo && id === activeAccountId) {
      resetWorkspace();
      setActiveAccountId(remaining[0]?.id ?? 'server');
    }
  }, [accounts, activeAccountId, isDemo]);

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
      if (generation.current === currentGeneration) setAuditEntries(entries);
    } catch {
      /* ignore non-critical audit error */
    }
  }, [api, currentGeneration]);

  const refreshRepos = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    try {
      const [repoList, orgList] = await Promise.all([
        api.listRepos(),
        api.listOrgs().catch(() => [] as GitHubOrg[]),
      ]);
      if (generation.current !== currentGeneration) return;
      setRepos(repoList);
      setOrgs(orgList);
    } catch (err: any) {
      if (generation.current === currentGeneration) setReposError(err?.message || 'Unable to load repositories.');
    } finally {
      if (generation.current === currentGeneration) setReposLoading(false);
    }
  }, [api, currentGeneration]);

  const refreshAll = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const [h, status] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getAuthStatus(),
      ]);
      if (generation.current !== currentGeneration) return;
      setHealth(h);
      setAuth(status);
      if (!isDemo && activeAccountId === 'server' && status.authenticated && status.user) {
        setAccounts((prev) => [{ id: 'server', login: status.user!.login, name: status.user!.name, source: 'server' }, ...prev.filter((a) => a.id !== 'server')]);
      }

      if (status.authenticated) {
        await Promise.all([refreshRepos(), refreshAudit()]);
      } else {
        setRepos([]);
        setOrgs([]);
      }
    } catch (err: any) {
      if (generation.current !== currentGeneration) return;
      setAuthError(err?.message || 'Failed to check GitHub authentication status.');
      setAuth({
        authenticated: false,
        token_source: 'none',
        scopes: [],
        api_base: 'https://api.github.com',
      });
    } finally {
      if (generation.current === currentGeneration) setAuthLoading(false);
    }
  }, [api, refreshRepos, refreshAudit, currentGeneration, isDemo, activeAccountId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const connectPat = useCallback(async (token: string) => {
    const candidate = token.trim();
    if (!candidate) throw new Error('Enter a personal access token.');
    // Validate without mutating the server-wide session. Each account client sends its own token.
    const status = await createApiClient(false, candidate).getAuthStatus();
    if (!status.authenticated || !status.user) throw new Error('Could not verify this GitHub account.');
    const id = `account:${status.user.id}`;
    resetWorkspace();
    setAccounts((prev) => [...prev.filter((account) => account.id !== id), { id, login: status.user!.login, name: status.user!.name, source: 'session', token: candidate }]);
    setIsDemo(false);
    setActiveAccountId(id);
    pushToast('success', `Added @${status.user.login}. Loading its workspace…`);
  }, [pushToast]);

  const disconnectPat = useCallback(async () => {
    if (activeAccountId && activeAccountId !== 'server') removeAccount(activeAccountId);
    else {
      await createApiClient(false).disconnectToken();
      resetWorkspace();
      setAccounts((prev) => prev.filter((account) => account.id !== 'server'));
      setActiveAccountId('server');
      // The server account may fall back to an environment token.
      await refreshAll();
    }
  }, [activeAccountId, removeAccount, refreshAll]);

  const enterDemoWorkspace = useCallback(async () => {
    resetWorkspace();
    setIsDemo(true);
    pushToast('info', 'Entered Sample Workspace (Demo Data).');
  }, [pushToast]);

  const exitDemoWorkspace = useCallback(async () => {
    resetWorkspace();
    setIsDemo(false);
    setSection('token');
  }, []);

  const toggleSelectRepo = useCallback((fullName: string) => {
    setSelectedFullNames((prev) =>
      prev.includes(fullName) ? prev.filter((n) => n !== fullName) : [...prev, fullName]
    );
  }, []);

  const upsertRepoInList = useCallback((updated: Repository, previousFullName?: string) => {
    if (generation.current !== currentGeneration) return;
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
  }, [currentGeneration]);

  const removeRepoFromList = useCallback((fullName: string) => {
    if (generation.current !== currentGeneration) return;
    setRepos((prev) => prev.filter((r) => r.full_name !== fullName));
    setSelectedFullNames((prev) => prev.filter((n) => n !== fullName));
  }, [currentGeneration]);

  return (
    <AppContext.Provider
      value={{
        api,
        accounts: accounts.map(({ token: _token, ...summary }) => summary),
        activeAccountId: isDemo ? null : activeAccountId,
        switchAccount,
        removeAccount,
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
