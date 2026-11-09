import { useState } from 'react';
import { fetchUsageStats, getAdminKey, setAdminKey, type UsageStats } from '../../data/usageCount';
import { formatLocalDate } from '../../domain/dates';

const REASON: Record<'key' | 'network' | 'server', string> = {
  key: 'That key wasn’t accepted. Check it and try again.',
  network: 'Couldn’t reach the counter. Check your connection.',
  server: 'The counter answered with an error. Try again later.',
};

/**
 * Owner-only view of the anonymous usage count. Needs the admin key, which is
 * kept on this device only; other users can open this page but see nothing
 * without it.
 */
export function AllUsersSection() {
  const [key, setKey] = useState(getAdminKey);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (k: string) => {
    setBusy(true);
    setError(null);
    const r = await fetchUsageStats(k.trim());
    setBusy(false);
    if (r.ok) {
      setAdminKey(k.trim());
      setStats(r.stats);
    } else {
      setStats(null);
      setError(REASON[r.reason]);
      if (r.reason === 'key') setAdminKey('');
    }
  };

  return (
    <section className="page-section" aria-labelledby="admin-all-users">
      <h2 id="admin-all-users">All users (anonymous count)</h2>
      <div className="card stack-sm" data-testid="admin-all-users">
        <form
          className="stack-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void load(key);
          }}
        >
          <div className="field">
            <label htmlFor="admin-key" className="field-label">Owner key</label>
            <input id="admin-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
            <p className="field-hint">Saved on this phone only. Without it the counter shares nothing.</p>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={busy || !key.trim()}>
              {busy ? 'Loading…' : stats ? 'Refresh' : 'Show numbers'}
            </button>
          </div>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {stats && <StatsView stats={stats} />}
        <p className="xs faint">Counts only people who switched on “Help count active users”. A device is counted once per day (UTC). Rows are deleted after 90 days.</p>
      </div>
    </section>
  );
}

function StatsView({ stats }: { stats: UsageStats }) {
  const tiles: [string, number][] = [
    ['Today', stats.today],
    ['Last 7 days', stats.last7],
    ['Last 30 days', stats.last30],
    ['Came back on 2+ days', stats.returning30],
  ];
  return (
    <div className="stack-sm" data-testid="admin-stats">
      <dl className="admin-tiles">
        {tiles.map(([label, n]) => (
          <div key={label} className="admin-tile">
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
      <table className="data-table admin-table">
        <tbody>
          <tr>
            <th scope="row">Installed to Home Screen (7 days)</th>
            <td>{stats.installed7}</td>
          </tr>
          {stats.versions7.map((v) => (
            <tr key={v.v}>
              <th scope="row">Version {v.v} (7 days)</th>
              <td>{v.devices}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.daily.length > 0 && (
        <table className="data-table admin-table">
          <caption className="xs faint">Devices per day, last 30 days</caption>
          <tbody>
            {stats.daily.map((d) => (
              <tr key={d.day}>
                <th scope="row">{formatLocalDate(d.day)}</th>
                <td>{d.devices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
