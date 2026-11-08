import React from 'react';
import { FolderPlus } from 'lucide-react';
import { AuditLogView } from './components/audit/AuditLogView';
import { TokenVaultPanel } from './components/auth/TokenVaultPanel';
import { AppShell } from './components/layout/AppShell';
import { BatchOperationsView } from './components/repos/BatchOperationsView';
import { CreateRepoView } from './components/repos/CreateRepoView';
import { RepoWorkspace } from './components/repos/detail/RepoWorkspace';
import { RepoLedgerView } from './components/repos/RepoLedgerView';
import { ToastRegion } from './components/ui/ToastRegion';
import { Skeleton } from './components/ui/Skeleton';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';

const WorkspaceRouter: React.FC = () => {
  const { auth, authLoading, authError, refreshAll, section, activeRepoSlug, navigateTo } = useApp();

  if (authLoading) {
    return (
      <AppShell
        pageTitle="Connecting to Local Server…"
        pageSubtitle="Checking GitHub Personal Access Token session"
      >
        <div className="panel">
          <Skeleton label="Verifying local server status" />
        </div>
      </AppShell>
    );
  }

  // If no PAT is connected and user hasn't entered Sample Workspace yet, guide them directly to Token setup
  if (!auth?.authenticated) {
    return (
      <AppShell
        pageTitle="Connect GitHub Personal Access Token"
        pageSubtitle="Authenticate with your local Actix Web server or explore the labeled Sample Workspace"
      >
        {authError && (
          <div className="alert-box alert-error connection-error" role="alert">
            <div><strong>Could not reach the server.</strong><div>{authError}</div></div>
            <button type="button" className="btn btn-sm" onClick={() => void refreshAll()}>Retry connection</button>
          </div>
        )}
        <TokenVaultPanel />
        <ToastRegion />
      </AppShell>
    );
  }

  let title = 'Repository Ledger';
  let subtitle = 'Inspect, rename, re-scope visibility, and manage your GitHub repositories';
  let primaryAction: React.ReactNode = (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => navigateTo('create')}
    >
      <FolderPlus size={14} aria-hidden="true" />
      New Repository
    </button>
  );

  if (section === 'create') {
    title = 'Create Repository';
    subtitle = 'Provision a personal or organization repository with templates and merge policies';
    primaryAction = null;
  } else if (section === 'batch') {
    title = 'Batch Operations';
    subtitle = 'Apply visibility, topic, archive, or policy updates across multiple repositories';
  } else if (section === 'audit') {
    title = 'Session Audit Log';
    subtitle = 'Traceable history of repository operations executed from this local server';
  } else if (section === 'token') {
    title = 'Token & Connection';
    subtitle = 'Inspect OAuth scopes, API quota, and runtime authentication state';
    primaryAction = null;
  } else if (section === 'repo-detail' && activeRepoSlug) {
    title = `${activeRepoSlug.owner}/${activeRepoSlug.repo}`;
    subtitle = 'Repository configuration, branches, files, issues, releases, webhooks & danger zone';
  }

  return (
    <AppShell pageTitle={title} pageSubtitle={subtitle} primaryAction={primaryAction}>
      {section === 'ledger' && <RepoLedgerView />}
      {section === 'create' && <CreateRepoView />}
      {section === 'batch' && <BatchOperationsView />}
      {section === 'audit' && <AuditLogView />}
      {section === 'token' && <TokenVaultPanel />}
      {section === 'repo-detail' && activeRepoSlug && (
        <RepoWorkspace owner={activeRepoSlug.owner} repoName={activeRepoSlug.repo} />
      )}
      <ToastRegion />
    </AppShell>
  );
};

export const App: React.FC = () => (
  <ThemeProvider>
    <AppProvider>
      <WorkspaceRouter />
    </AppProvider>
  </ThemeProvider>
);

export default App;
