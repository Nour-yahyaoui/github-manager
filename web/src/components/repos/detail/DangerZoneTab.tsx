import React, { useState } from 'react';
import { Archive, ArrowRightLeft, Trash2 } from 'lucide-react';
import type { Repository } from '../../../api/types';
import { useApp } from '../../../context/AppContext';
import { ConfirmDangerModal } from '../../ui/ConfirmDangerModal';

interface Props {
  repo: Repository;
  onUpdated: (updated: Repository, prevFull?: string) => void;
}

export const DangerZoneTab: React.FC<Props> = ({ repo, onUpdated }) => {
  const { api, removeRepoFromList, refreshAudit, navigateTo, pushToast } = useApp();

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [newOwner, setNewOwner] = useState('');
  const [working, setWorking] = useState(false);

  const handleToggleArchive = async () => {
    setWorking(true);
    try {
      const updated = await api.updateRepo(repo.owner.login, repo.name, {
        archived: !repo.archived,
      });
      onUpdated(updated);
      void refreshAudit();
      pushToast(
        'success',
        updated.archived ? `Archived ${updated.full_name}` : `Unarchived ${updated.full_name}`
      );
      setArchiveModalOpen(false);
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to update archive state.');
    } finally {
      setWorking(false);
    }
  };

  const handleTransfer = async () => {
    if (!newOwner.trim()) {
      pushToast('error', 'Enter destination GitHub user or organization login.');
      return;
    }
    setWorking(true);
    const prevFull = repo.full_name;
    try {
      const updated = await api.transferRepo(repo.owner.login, repo.name, newOwner.trim());
      onUpdated(updated, prevFull);
      void refreshAudit();
      pushToast('success', `Initiated transfer to @${newOwner.trim()}`);
      setTransferModalOpen(false);
    } catch (err: any) {
      pushToast('error', err?.message || 'Transfer failed.');
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async () => {
    setWorking(true);
    try {
      await api.deleteRepo(repo.owner.login, repo.name);
      removeRepoFromList(repo.full_name);
      void refreshAudit();
      pushToast('success', `Deleted ${repo.full_name}`);
      setDeleteModalOpen(false);
      navigateTo('ledger');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to delete repository.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <section
      className="panel"
      style={{ borderColor: 'var(--danger-border)' }}
      aria-labelledby="danger-zone-heading"
    >
      <div className="panel-header" style={{ borderBottomColor: 'var(--danger-border)' }}>
        <h3 id="danger-zone-heading" style={{ color: 'var(--danger-text)' }}>
          Danger Zone
        </h3>
      </div>

      <div className="panel-body">
        <div className="setting-row">
          <div>
            <div className="setting-title">
              {repo.archived ? 'Unarchive this repository' : 'Archive this repository'}
            </div>
            <p className="setting-desc">
              {repo.archived
                ? 'Restore write access for commits, issues, pull requests, and settings.'
                : 'Mark this repository as archived and read-only for all contributors.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={() => setArchiveModalOpen(true)}
          >
            <Archive size={14} aria-hidden="true" />
            {repo.archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-title">Transfer repository ownership</div>
            <p className="setting-desc">
              Transfer <code>{repo.full_name}</code> to another GitHub user or organization where you
              have repository creation rights.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input mono"
              style={{ width: 185 }}
              aria-label="Destination owner username or organization"
              placeholder="new-owner-login"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-danger-outline"
              disabled={!newOwner.trim()}
              onClick={() => setTransferModalOpen(true)}
            >
              <ArrowRightLeft size={14} aria-hidden="true" />
              Transfer
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-title">Delete this repository</div>
            <p className="setting-desc">
              Once deleted, there is no going back. Requires <code>delete_repo</code> scope on
              classic PATs or Administration write permission on fine-grained PATs.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete Repository
          </button>
        </div>
      </div>

      <ConfirmDangerModal
        open={archiveModalOpen}
        title={repo.archived ? `Unarchive ${repo.full_name}` : `Archive ${repo.full_name}`}
        description={
          repo.archived
            ? `Unarchiving ${repo.full_name} restores write access to branches, issues, pull requests, and settings.`
            : `Archiving ${repo.full_name} freezes all code, issues, comments, and settings into read-only mode.`
        }
        confirmLabel={repo.archived ? 'Unarchive Repository' : 'Archive Repository'}
        loading={working}
        onConfirm={handleToggleArchive}
        onClose={() => setArchiveModalOpen(false)}
      />

      <ConfirmDangerModal
        open={transferModalOpen}
        title={`Transfer ${repo.full_name} to @${newOwner.trim()}`}
        description={`Transferring ownership moves ${repo.full_name} to @${newOwner.trim()}. Type ${repo.full_name} to confirm.`}
        confirmLabel="Confirm Ownership Transfer"
        requirePhrase={repo.full_name}
        loading={working}
        onConfirm={handleTransfer}
        onClose={() => setTransferModalOpen(false)}
      />

      <ConfirmDangerModal
        open={deleteModalOpen}
        title={`Permanently Delete ${repo.full_name}`}
        description={`Deleting ${repo.full_name} permanently removes all git commits, branches, tags, issues, pull requests, and releases on GitHub.`}
        confirmLabel="Permanently Delete Repository"
        requirePhrase={repo.full_name}
        loading={working}
        onConfirm={handleDelete}
        onClose={() => setDeleteModalOpen(false)}
      />
    </section>
  );
};
