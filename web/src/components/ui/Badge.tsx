import React from 'react';
import { Archive, BookTemplate, GitFork, Globe, Lock } from 'lucide-react';
import type { Repository } from '../../api/types';

export const VisibilityBadge: React.FC<{ privateRepo: boolean; visibility?: string | null }> = ({
  privateRepo,
  visibility,
}) => {
  const label = visibility
    ? visibility.charAt(0).toUpperCase() + visibility.slice(1)
    : privateRepo
      ? 'Private'
      : 'Public';

  if (privateRepo || visibility === 'private' || visibility === 'internal') {
    return (
      <span className="badge badge-private">
        <Lock size={11} aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <span className="badge badge-public">
      <Globe size={11} aria-hidden="true" />
      {label}
    </span>
  );
};

export const RepoStateBadges: React.FC<{ repo: Repository }> = ({ repo }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
    <VisibilityBadge privateRepo={repo.private} visibility={repo.visibility} />
    {repo.archived && (
      <span className="badge badge-archived">
        <Archive size={11} aria-hidden="true" />
        Archived
      </span>
    )}
    {repo.is_template && (
      <span className="badge">
        <BookTemplate size={11} aria-hidden="true" />
        Template
      </span>
    )}
    {repo.fork && (
      <span className="badge">
        <GitFork size={11} aria-hidden="true" />
        Fork
      </span>
    )}
  </span>
);
