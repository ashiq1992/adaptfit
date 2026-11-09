import { type ChangeEvent, useState } from 'react';
import type { Backup, BackupSummary } from '../../data/backup';
import { MAX_BACKUP_BYTES } from '../../data/backupLimits';
import { useAnnounce } from '../../ui/Announcer';
import { ConfirmDialog } from '../../ui/Dialog';
import { navigate } from '../../ui/hooks';

/** Backup code (and Zod) loads on demand to keep the main bundle small. */
export const loadBackup = () => import('../../data/backup');

type Status = { tone: 'ok' | 'error'; text: string } | null;

/**
 * Choose a backup file → validate it (no data changes) → confirm → restore in
 * one transaction. Invalid files leave current data untouched.
 */
export function RestoreBackup({ hasExistingData }: { hasExistingData: boolean }) {
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | null>(null);
  const [busy, setBusy] = useState(false);
  const announce = useAnnounce();

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setPending(null);
    if (!file) return;
    const { readBackupFile } = await loadBackup();
    const result = await readBackupFile(file);
    if (!result.ok) {
      setStatus({ tone: 'error', text: `${result.error} ${hasExistingData ? 'Your current data was not changed.' : ''}`.trim() });
      announce(`Backup not restored. ${result.error}`);
      return;
    }
    setStatus(null);
    setPending({ backup: result.backup, summary: result.summary });
  };

  const doRestore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const { restoreBackup } = await loadBackup();
      await restoreBackup(pending.backup);
      setStatus({ tone: 'ok', text: 'Backup restored.' });
      announce('Backup restored.');
      setPending(null);
      navigate('/plan');
    } catch (err) {
      setStatus({ tone: 'error', text: err instanceof Error ? err.message : 'Restore failed. Your existing data was kept.' });
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <label className="btn btn-secondary btn-block file-btn">
        Choose backup file…
        <input type="file" accept="application/json,.json" className="visually-hidden" onChange={onFile} data-testid="restore-input" />
      </label>
      <p className="small muted">Files over {MAX_BACKUP_BYTES / 1024 / 1024} MB are rejected. The file is checked before anything changes.</p>
      {status && (
        <p className={status.tone === 'ok' ? 'success' : 'error'} role={status.tone === 'ok' ? 'status' : 'alert'} data-testid="import-status">
          {status.text}
        </p>
      )}
      {pending && (
        <ConfirmDialog
          title={hasExistingData ? 'Replace all data with this backup?' : 'Restore this backup?'}
          confirmLabel={hasExistingData ? 'Replace my data' : 'Restore backup'}
          danger={hasExistingData}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={doRestore}
        >
          <p>This backup is valid.{hasExistingData ? ' Restoring replaces everything currently on this device:' : ' It contains:'}</p>
          <ul className="small">
            <li>Exported {new Date(pending.summary.exportedAt).toLocaleString()}</li>
            <li>{pending.summary.completedSessions} completed workouts</li>
            <li>{pending.summary.checkIns} check-ins</li>
            <li>{pending.summary.hasActiveSession ? 'Includes a workout in progress' : 'No workout in progress'}</li>
          </ul>
        </ConfirmDialog>
      )}
    </>
  );
}
