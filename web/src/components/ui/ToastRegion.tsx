import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ToastRegion: React.FC = () => {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item toast-${t.kind}`}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            {t.kind === 'success' && (
              <CheckCircle2
                size={16}
                style={{ color: 'var(--success-text)', flexShrink: 0, marginTop: 2 }}
                aria-hidden="true"
              />
            )}
            {t.kind === 'error' && (
              <AlertCircle
                size={16}
                style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 2 }}
                aria-hidden="true"
              />
            )}
            {t.kind === 'info' && (
              <Info
                size={16}
                style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }}
                aria-hidden="true"
              />
            )}
            <span>{t.text}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost icon-btn"
            style={{ minWidth: 26, minHeight: 26, padding: 2 }}
            aria-label="Dismiss notification"
            onClick={() => dismissToast(t.id)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};
