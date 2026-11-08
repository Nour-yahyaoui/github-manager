import React from 'react';
import { History, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AuditLogView: React.FC = () => {
  const { api, auditEntries, refreshAudit, pushToast } = useApp();

  const handleClear = async () => {
    try {
      await api.clearAudit();
      await refreshAudit();
      pushToast('info', 'Cleared session audit log.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to clear audit log.');
    }
  };

  return (
    <section className="panel" aria-labelledby="audit-log-heading">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} aria-hidden="true" />
          <h2 id="audit-log-heading">Operational Session Audit Log</h2>
        </div>
        {auditEntries.length > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => void handleClear()}>
            <Trash2 size={13} aria-hidden="true" />
            Clear Log
          </button>
        )}
      </div>

      {auditEntries.length === 0 ? (
        <div className="empty-state">
          <History size={26} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <h3>No mutations recorded in this session yet</h3>
          <p>
            Every repository creation, rename, visibility change, branch action, commit, release, or
            batch update performed from this server appears here with an exact timestamp.
          </p>
        </div>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Audit log table (scroll horizontally for more columns)" style={{ border: 'none', borderRadius: 0 }}>
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="mono tabular" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td>
                    <code className="mono" style={{ fontSize: 12 }}>
                      {entry.action}
                    </code>
                  </td>
                  <td className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {entry.target}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        entry.status === 'success'
                          ? 'badge-public'
                          : entry.status === 'demo'
                            ? 'badge-archived'
                            : ''
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
