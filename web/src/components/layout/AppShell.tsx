import React, { useEffect, useRef, useState } from 'react';
import {
  BookMarked,
  FlaskConical,
  FolderPlus,
  History,
  KeyRound,
  Layers,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react';
import { type NavSection, useApp } from '../../context/AppContext';
import { type ThemePreference, useTheme } from '../../context/ThemeContext';
import { RateLimitMeter } from './RateLimitMeter';
import { GettingStarted } from '../onboarding/GettingStarted';

const BrandMark: React.FC = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <rect width="32" height="32" rx="6" fill="#1a2438" />
    <rect x="1" y="1" width="30" height="30" rx="5" stroke="#36496e" strokeWidth="1.2" />
    <circle cx="11" cy="10" r="2.4" stroke="#60a5fa" strokeWidth="2" />
    <circle cx="11" cy="22" r="2.4" stroke="#60a5fa" strokeWidth="2" />
    <circle cx="21" cy="16" r="2.4" stroke="#e6edf3" strokeWidth="2" />
    <path
      d="M11 12.5V19.5M13.5 10H17C19.2 10 21 11.8 21 14V13.6"
      stroke="#60a5fa"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

interface AppShellProps {
  pageTitle: string;
  pageSubtitle?: string;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  pageTitle,
  pageSubtitle,
  primaryAction,
  children,
}) => {
  const {
    isDemo,
    exitDemoWorkspace,
    auth,
    authLoading,
    repos,
    reposLoading,
    selectedFullNames,
    auditEntries,
    section,
    navigateTo,
    refreshRepos,
    refreshAudit,
  } = useApp();
  const { preference, setPreference } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const drawer = mobileDrawerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer?.querySelector<HTMLButtonElement>('button')?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !drawer) return;
      const buttons = Array.from(drawer.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = previousOverflow;
      if (window.innerWidth <= 960) menuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onResize = () => {
      if (window.innerWidth > 960) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mobileOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
        return;
      }
      if (mobileOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement | null)?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        const searchEl = document.getElementById('repo-ledger-search') as HTMLInputElement | null;
        if (searchEl) {
          e.preventDefault();
          searchEl.focus();
        }
      } else if (e.key === '[') {
        e.preventDefault();
        setCollapsed((c) => !c);
      } else if (e.key === 'c' && auth?.authenticated) {
        e.preventDefault();
        navigateTo('create');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, auth?.authenticated, navigateTo]);

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    {
      id: 'ledger',
      label: 'Repositories',
      icon: <BookMarked size={16} aria-hidden="true" />,
      count: auth?.authenticated ? repos.length : undefined,
    },
    {
      id: 'create',
      label: 'Create Repository',
      icon: <FolderPlus size={16} aria-hidden="true" />,
    },
    {
      id: 'batch',
      label: 'Batch Operations',
      icon: <Layers size={16} aria-hidden="true" />,
      count: selectedFullNames.length > 0 ? selectedFullNames.length : undefined,
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: <History size={16} aria-hidden="true" />,
      count: auditEntries.length > 0 ? auditEntries.length : undefined,
    },
    {
      id: 'token',
      label: 'Token & Connection',
      icon: <KeyRound size={16} aria-hidden="true" />,
    },
  ];

  const handleSelectNav = (id: NavSection) => {
    navigateTo(id);
    setMobileOpen(false);
    if (id === 'audit') {
      void refreshAudit();
    }
  };

  const cycleTheme = () => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setPreference(next);
  };

  const renderRailContent = (isCompact: boolean, isMobileDrawer = false) => (
    <>
      <div className="rail-brand">
        <div className="rail-brand-title">
          <BrandMark />
          {!isCompact && (
            <div>
              <span className="rail-brand-name">GitHub Manager</span>
              <span className="rail-brand-sub">Actix Control Plane</span>
            </div>
          )}
        </div>
        {isMobileDrawer ? (
          <button
            type="button"
            className="rail-collapse-btn"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="rail-collapse-btn"
            aria-label={isCompact ? 'Expand navigation rail' : 'Collapse navigation rail'}
            title={isCompact ? 'Expand navigation ([)' : 'Collapse navigation ([)'}
            onClick={() => setCollapsed((c) => !c)}
          >
            {isCompact ? (
              <PanelLeftOpen size={15} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={15} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {!isCompact && <div className="rail-section-label">Workspace</div>}

      <nav aria-label="Primary">
        <ul className="rail-nav-list">
          {navItems.map((item) => {
            const isActive =
              section === item.id || (section === 'repo-detail' && item.id === 'ledger');
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="rail-nav-btn"
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={isCompact ? item.label : undefined}
                  title={isCompact ? item.label : undefined}
                  onClick={() => handleSelectNav(item.id)}
                >
                  <span className="rail-nav-btn-left">
                    {item.icon}
                    {!isCompact && <span>{item.label}</span>}
                  </span>
                  {!isCompact && item.count !== undefined && (
                    <span className="rail-count">{item.count}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="rail-footer">
        {!isCompact && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--rail-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Mode</span>
              <span className="mono" style={{ color: 'var(--rail-text)' }}>
                {isDemo ? 'Demo Data' : auth?.authenticated ? 'Live PAT' : 'Unconfigured'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Shortcuts</span>
              <span className="mono">/ · c · [</span>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`app-shell${collapsed ? ' rail-collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <aside className="nav-rail desktop-only">{renderRailContent(collapsed, false)}</aside>

      {mobileOpen && (
        <div
          className="mobile-rail-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        >
          <div
            id="mobile-navigation"
            className="mobile-rail-drawer"
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {renderRailContent(false, true)}
          </div>
        </div>
      )}

      <div className="workspace-col">
        {isDemo && (
          <div className="demo-banner" role="region" aria-label="Sample Workspace notice">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <FlaskConical size={15} aria-hidden="true" />
              <span>
                <strong>SAMPLE WORKSPACE · DEMO DATA:</strong> Simulated repositories stored in
                browser memory only. Connect a real GitHub PAT to manage live repositories.
              </span>
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void exitDemoWorkspace()}
            >
              Connect Real GitHub PAT
            </button>
          </div>
        )}

        <header className="top-header">
          <div className="top-header-left">
            <button
              type="button"
              className="mobile-menu-btn"
              ref={menuButtonRef}
              aria-expanded={mobileOpen}
              aria-controls={mobileOpen ? 'mobile-navigation' : undefined}
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <div className="page-title-group">
              <h1>{pageTitle}</h1>
              {pageSubtitle && <p className="page-subtitle">{pageSubtitle}</p>}
            </div>
          </div>

          <div className="top-header-actions">
            <RateLimitMeter />

            {auth?.authenticated && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={reposLoading}
                aria-label="Sync repositories from GitHub"
                title="Sync repositories"
                onClick={() => void refreshRepos()}
              >
                <RefreshCw size={13} aria-hidden="true" />
                <span>{reposLoading ? 'Syncing…' : 'Sync'}</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-sm"
              aria-label={`Theme: ${preference}. Activate to switch theme.`}
              title={`Theme: ${preference} (click to cycle Light / Dark / System)`}
              onClick={cycleTheme}
            >
              {preference === 'light' && <Sun size={13} aria-hidden="true" />}
              {preference === 'dark' && <Moon size={13} aria-hidden="true" />}
              {preference === 'system' && <Monitor size={13} aria-hidden="true" />}
              <span style={{ textTransform: 'capitalize' }}>{preference}</span>
            </button>

            {primaryAction}
          </div>
        </header>

        <main id="main-content" className="main-content" tabIndex={-1}>
          {!authLoading && <GettingStarted />}
          {children}
        </main>
      </div>
    </div>
  );
};
