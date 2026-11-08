import React from 'react';
import { Activity, ShieldCheck, ShieldOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const RateLimitMeter: React.FC = () => {
  const { auth, isDemo, navigateTo } = useApp();

  if (isDemo) {
    return (
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => navigateTo('token')}
        title="Sample Workspace active — click to connect a GitHub PAT"
      >
        <Activity size={13} aria-hidden="true" />
        <span>Demo Mode</span>
      </button>
    );
  }

  if (!auth?.authenticated) {
    return (
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => navigateTo('token')}
        title="Connect a GitHub Personal Access Token"
      >
        <ShieldOff size={13} style={{ color: 'var(--danger-text)' }} aria-hidden="true" />
        <span>No PAT</span>
      </button>
    );
  }

  const rl = auth.rate_limit;
  return (
    <button
      type="button"
      className="btn btn-sm tabular"
      onClick={() => navigateTo('token')}
      title={
        rl
          ? `GitHub REST API quota: ${rl.remaining} of ${rl.limit} requests remaining`
          : `Connected as @${auth.user?.login}`
      }
    >
      <ShieldCheck size={13} style={{ color: 'var(--success-text)' }} aria-hidden="true" />
      <span>@{auth.user?.login}</span>
      {rl && (
        <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>
          {rl.remaining}/{rl.limit}
        </span>
      )}
    </button>
  );
};
