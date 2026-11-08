import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDangerModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  requirePhrase?: string;
  loading?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const ConfirmDangerModal: React.FC<ConfirmDangerModalProps> = ({
  open,
  title,
  description,
  confirmLabel,
  requirePhrase,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const canConfirm = !requirePhrase || typed.trim() === requirePhrase;

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!loading) onClose();
      }}
      footer={
        <>
          <button type="button" className="btn" disabled={loading} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!canConfirm || loading}
            onClick={() => void onConfirm()}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="alert-box alert-error">
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div>{description}</div>
        </div>

        {requirePhrase && (
          <div className="field">
            <label htmlFor="danger-confirm-input" className="field-label">
              Type <code className="mono">{requirePhrase}</code> to confirm
            </label>
            <input
              id="danger-confirm-input"
              type="text"
              className="input mono"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requirePhrase}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
