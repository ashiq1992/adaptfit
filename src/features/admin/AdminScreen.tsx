import { useEffect, useState } from 'react';
import { DB_NAME, getDb } from '../../data/db';
import { usePwa } from '../../pwa';
import { useAnnounce } from '../../ui/Announcer';
import { useLive } from '../../ui/hooks';
import { ScreenHeader, useOnline } from '../../ui/ScreenHeader';
import { THEMES, useTheme } from '../../ui/theme';
import { formatBytes, formatWhen, summariseDevice, summariseUserAgent, type DeviceSummary } from './diagnostics';
import { AllUsersSection } from './AllUsersSection';
import { usageCountAvailable } from '../../data/usageCount';
import './admin.css';

/** Injected at build time from package.json (see vite.config.ts `define`). */
declare const __APP_VERSION__: string;

interface StorageInfo {
  supported: boolean;
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

function useStorageInfo(): [StorageInfo, () => Promise<void>] {
  const [info, setInfo] = useState<StorageInfo>({ supported: false, usage: null, quota: null, persisted: null });
  const read = async () => {
    const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!s) {
      setInfo({ supported: false, usage: null, quota: null, persisted: null });
      return;
    }
    const [est, persisted] = await Promise.all([s.estimate ? s.estimate().catch(() => null) : null, s.persisted ? s.persisted().catch(() => null) : null]);
    setInfo({ supported: true, usage: est?.usage ?? null, quota: est?.quota ?? null, persisted });
  };
  useEffect(() => {
    void read();
  }, []);
  return [info, read];
}

function isStandalone(): boolean {
  const mq = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return mq || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

async function loadSummary(): Promise<DeviceSummary> {
  const db = getDb();
  const [profiles, programmes, trainingWeeks, sessions, imports, bodyweights, revisionDates] = await Promise.all([
    db.profile.toArray(),
    db.programmes.toArray(),
    db.trainingWeeks.toArray(),
    db.sessions.toArray(),
    db.imports.toArray(),
    db.bodyweights.toArray(),
    // Only the indexed timestamps — revisions hold full note snapshots we don't need here.
    db.noteRevisions.orderBy('at').keys(),
  ]);
  return summariseDevice({
    profiles,
    programmes,
    trainingWeeks,
    sessions,
    imports,
    bodyweights,
    noteRevisions: revisionDates.map((at) => ({ at: String(at) })),
  });
}

/**
 * On-device diagnostics for the owner. AdaptFit has no accounts or server, so
 * this page can only describe this browser on this device — never other people.
 */
export function AdminScreen() {
  const live = useLive(loadSummary, []);
  const pwa = usePwa();
  const online = useOnline();
  const theme = useTheme();
  const announce = useAnnounce();
  const [storage, refreshStorage] = useStorageInfo();
  const [persistMsg, setPersistMsg] = useState<string | null>(null);
  const standalone = isStandalone();
  const controlled = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  const summary = live.data;

  const askPersist = async () => {
    if (!navigator.storage?.persist) {
      setPersistMsg('This browser does not offer persistent storage.');
      return;
    }
    const granted = await navigator.storage.persist().catch(() => false);
    const msg = granted
      ? 'Done — this browser will keep AdaptFit’s data unless you delete it.'
      : 'The browser declined for now. Installing to the Home Screen and using the app regularly usually helps. Keep exporting backups.';
    setPersistMsg(msg);
    announce(msg);
    await refreshStorage();
  };

  const rows: [string, string][] = summary
    ? [
        ['Profiles', String(summary.counts.profiles)],
        ['Workout notes / programmes', String(summary.counts.programmes)],
        ['Weekly records — confirmed', String(summary.counts.weeksConfirmed)],
        ['Weekly records — draft', String(summary.counts.weeksDraft)],
        ['Workout sessions', String(summary.counts.sessions)],
        ['Imports', String(summary.counts.imports)],
        ['Bodyweight entries', String(summary.counts.bodyweights)],
        ['Note revisions', String(summary.counts.noteRevisions)],
      ]
    : [];

  return (
    <div className="screen">
      <ScreenHeader back={{ href: '#/settings', label: 'Settings' }} title="Admin" subtitle="Diagnostics for this device" />
      <div className="stack">
        <div className="card admin-notice" role="note" data-testid="admin-device-only">
          <p className="strong">{usageCountAvailable() ? 'Device details on this page are from this phone only.' : 'This page shows this device only.'}</p>
          <p className="small muted">
            {usageCountAvailable()
              ? 'Everything above “All users” is read from this phone. The all-users numbers come from the anonymous count, and only include people who switched it on.'
              : "AdaptFit has no accounts or server, so it can't see other people. Nothing on this page is sent anywhere."}
          </p>
        </div>

        <section className="page-section" aria-labelledby="admin-app">
          <h2 id="admin-app">App</h2>
          <div className="card">
            <table className="data-table admin-table">
              <tbody>
                <Row label="App version" value={__APP_VERSION__} testId="admin-version" />
                <Row label="Database" value={`${DB_NAME} · version ${getDb().verno}`} testId="admin-db-version" />
                <Row label="Theme" value={THEMES.find((t) => t.id === theme)?.label ?? theme} />
                <Row label="Browser" value={summariseUserAgent(navigator.userAgent)} />
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-section" aria-labelledby="admin-usage">
          <h2 id="admin-usage">Usage on this device</h2>
          <div className="card">
            {live.error ? (
              <p className="error" role="alert">
                Couldn't read on-device storage.
              </p>
            ) : !summary ? (
              <p className="muted">Loading…</p>
            ) : (
              <table className="data-table admin-table" data-testid="admin-counts">
                <tbody>
                  {rows.map(([k, v]) => (
                    <Row key={k} label={k} value={v} />
                  ))}
                  <Row label="First use" value={formatWhen(summary.firstUse)} testId="admin-first-use" />
                  <Row label="Last activity" value={formatWhen(summary.lastActivity)} testId="admin-last-activity" />
                </tbody>
              </table>
            )}
            <p className="xs faint">Dates come from the records stored on this device (earliest and latest saved change).</p>
          </div>
        </section>

        <section className="page-section" aria-labelledby="admin-storage">
          <h2 id="admin-storage">Storage</h2>
          <div className="card stack-sm">
            <table className="data-table admin-table">
              <tbody>
                <Row label="Used" value={storage.supported ? formatBytes(storage.usage) : 'Not available in this browser'} />
                <Row label="Available to this site" value={storage.supported ? formatBytes(storage.quota) : '—'} />
                <Row
                  label="Persistent storage"
                  value={storage.persisted === null ? 'Unknown' : storage.persisted ? 'Yes — kept unless you delete it' : 'No — the browser may clear it if space runs low'}
                  testId="admin-persisted"
                />
              </tbody>
            </table>
            {storage.persisted !== true && (
              <div>
                <button type="button" className="btn btn-secondary" onClick={() => void askPersist()}>
                  Keep my data on this device
                </button>
              </div>
            )}
            {persistMsg && (
              <p className="small" data-testid="admin-persist-msg">
                {persistMsg}
              </p>
            )}
            <p className="xs faint">Even with persistent storage, export a backup now and then (Settings → Data &amp; backups).</p>
          </div>
        </section>

        <section className="page-section" aria-labelledby="admin-offline">
          <h2 id="admin-offline">Install &amp; offline</h2>
          <div className="card">
            <table className="data-table admin-table">
              <tbody>
                <Row label="Opened as installed app" value={standalone ? 'Yes (Home Screen / standalone)' : 'No (in a browser tab)'} testId="admin-standalone" />
                <Row label="Service worker" value={!pwa.supported ? 'Not available here (needs HTTPS or localhost)' : pwa.error ? `Error: ${pwa.error}` : controlled ? 'Active and controlling this page' : 'Registered on next load'} />
                <Row label="Offline copy" value={pwa.offlineReady ? 'Ready — works without a connection' : 'Not ready yet'} testId="admin-offline-ready" />
                <Row label="Update waiting" value={pwa.needRefresh ? 'Yes — tap Refresh in the banner' : 'No'} />
                <Row label="Network" value={online ? 'Online' : 'Offline'} testId="admin-online" />
              </tbody>
            </table>
          </div>
        </section>

        {usageCountAvailable() ? (
          <AllUsersSection />
        ) : (
        <section className="page-section" aria-labelledby="admin-all-users">
          <h2 id="admin-all-users">See all users (needs a server)</h2>
          <div className="card stack-sm">
            <p className="small">
              Seeing who else uses AdaptFit would need a small server that each phone reports to. That changes the privacy promise, so it is your decision and would use your own free accounts. Options:
            </p>
            <ul className="bullet-list small">
              <li>Free serverless database (e.g. Cloudflare Workers + D1, Supabase, PocketBase, Firebase) receiving an anonymous daily “active device” ping.</li>
              <li>Strictly opt-in, with a random install ID only — no names, emails, or workout data.</li>
              <li>A privacy notice and an off switch in Settings before anything is sent.</li>
            </ul>
            <p className="xs muted">
              Details, free-tier limits and step-by-step setup: <code>docs/ADMIN_AND_ANALYTICS.md</code> in the project.
            </p>
          </div>
        </section>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td data-testid={testId}>{value}</td>
    </tr>
  );
}
