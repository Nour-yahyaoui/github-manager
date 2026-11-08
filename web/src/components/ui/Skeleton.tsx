import React from 'react';

/** Loading placeholder with a single announcement instead of repeated decorative content. */
export const Skeleton: React.FC<{ label: string; rows?: number }> = ({ label, rows = 3 }) => (
  <div className="skeleton-panel" role="status" aria-label={label}>
    <span className="skeleton-block skeleton-title" aria-hidden="true" />
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton-block skeleton-square" />
          <div className="skeleton-lines"><span className="skeleton-block skeleton-line" /><span className="skeleton-block skeleton-line short" /></div>
        </div>
      ))}
    </div>
    <span className="sr-only">{label}</span>
  </div>
);
