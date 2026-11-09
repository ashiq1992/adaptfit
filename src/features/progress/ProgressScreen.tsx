import { useId, useMemo, useState } from 'react';
import { targetForWeek } from '../../domain/coach';
import { addDays } from '../../domain/dates';
import { loadSuffix } from '../../domain/loads';
import { allExerciseStatuses, exerciseStatus, milestones, type ProgressStatus, STATUS_LABEL } from '../../domain/performance';
import { exerciseHistory, filterRange, type HistoryPoint, type Range, weeklyConsistency, weekStartOf } from '../../domain/progression';
import { LineChart, WeekBars } from '../../ui/Charts';
import { Segmented } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { IconChevronRight } from '../../ui/icons';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { shortDate, summaryLabel } from '../format';
import { BodyweightPanel } from './BodyweightPanel';

const RANGES = [
  { id: '4w', label: '4W' },
  { id: '8w', label: '8W' },
  { id: '12w', label: '12W' },
  { id: 'all', label: 'All' },
] as const;

const STATUS_CLASS: Record<ProgressStatus, string> = {
  improving: 'pill-progress',
  stable: '',
  'possible-decline': 'pill-attention',
  'possible-plateau': 'pill-attention',
  'insufficient-data': 'pill-muted',
};

/** Progress: meaningful summaries first; charts are one tap away. */
export function ProgressScreen({ exerciseKey }: { exerciseKey: string | null }) {
  if (exerciseKey) return <ExerciseDetail exKey={exerciseKey} />;
  return <Overview />;
}

function Overview() {
  const { data, today } = useApp();
  const ctx = { checkIns: data.checkIns, profile: data.profile };
  const statuses = useMemo(() => allExerciseStatuses(data.sessions, today, ctx), [data.sessions, today, data.checkIns, data.profile]); // eslint-disable-line react-hooks/exhaustive-deps
  const ms = useMemo(() => milestones({ sessions: data.sessions, weeks: data.trainingWeeks, programme: data.activeProgramme, bodyweights: data.bodyweights, profile: data.profile, today }), [data.sessions, data.trainingWeeks, data.activeProgramme, data.bodyweights, data.profile, today]);
  const bests = useMemo(() => personalBests(statuses.map((s) => s.points)), [statuses]);
  const weeks = weeklyConsistency(data.sessions, today, 8, (ws) => targetForWeek(data.activeProgramme, data.weekPlans, ws));
  const month = monthSummary(data.sessions, today);

  return (
    <div className="screen">
      <ScreenHeader title="Progress" subtitle="From your confirmed workouts only." settings />
      {data.completed.length === 0 ? (
        <section className="card empty">
          <h2 className="card-title">No recorded training yet</h2>
          <p className="small muted">Confirm a weekly update (or log a workout) and AdaptFit compares it with your next one. Nothing is estimated from averages.</p>
          <a href="#/week" className="btn btn-primary">
            Update this week
          </a>
        </section>
      ) : (
        <>
          <section className="card" aria-labelledby="changes-title">
            <h2 id="changes-title" className="card-title">
              Exercises
            </h2>
            <ul className="status-list">
              {statuses.slice(0, 8).map((s) => (
                <li key={s.key}>
                  <a href={`#/progress/${encodeURIComponent(s.key)}`} className="status-row">
                    <span className="status-main">
                      <span className="strong">{s.name}</span>
                      <span className="xs muted">{s.reason}</span>
                    </span>
                    <span className={`pill ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    <IconChevronRight />
                  </a>
                </li>
              ))}
            </ul>
            {statuses.length > 8 && (
              <details className="disclosure">
                <summary>All {statuses.length} exercises</summary>
                <ul className="status-list">
                  {statuses.slice(8).map((s) => (
                    <li key={s.key}>
                      <a href={`#/progress/${encodeURIComponent(s.key)}`} className="status-row">
                        <span className="status-main">
                          <span className="strong">{s.name}</span>
                        </span>
                        <span className={`pill ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="card" aria-labelledby="pb-title">
            <h2 id="pb-title" className="card-title">
              Personal bests
            </h2>
            {bests.length === 0 ? (
              <p className="small muted">Your best set per exercise appears here once you have records.</p>
            ) : (
              <ul className="change-rows">
                {bests.slice(0, 6).map((b) => (
                  <li key={b.key}>
                    <span className="small">{b.name}</span>
                    <span className="small num">
                      {summaryLabel(b.point.summary)}
                      <span className="block xs faint">{shortDate(b.point.localDate)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {ms.length > 0 && (
            <section className="card" aria-labelledby="ms-title">
              <h2 id="ms-title" className="card-title">
                Recent milestones
              </h2>
              <ul className="milestones">
                {ms.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    <span className="strong small">{m.title}</span>
                    <span className="xs muted">
                      {m.detail} · {shortDate(m.localDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card" aria-labelledby="freq-title">
            <div className="row between">
              <h2 id="freq-title" className="card-title">
                Training
              </h2>
              <span className="xs muted">
                {month.thisMonth} this month · {month.lastMonth} last month
              </span>
            </div>
            <WeekBars title="Sessions per week" weeks={weeks.map((w) => ({ label: shortDate(w.weekStart), completed: w.completed, target: w.target }))} />
            <p className="xs muted">Outline = planned sessions. Missed weeks are shown, never penalised.</p>
          </section>
        </>
      )}

      <details className="card disclosure" open={data.bodyweights.length > 0 && data.completed.length === 0}>
        <summary className="card-title">Bodyweight (optional)</summary>
        <BodyweightSection />
      </details>

      <a href="#/history" className="link-btn">
        All recorded workouts
      </a>
      <p className="xs faint">Only the same exercise recorded with the same loading convention is compared. Machines, Smith bars and dumbbells are never treated as equivalent.</p>
    </div>
  );
}

function BodyweightSection() {
  const [range, setRange] = useState<Range>('8w');
  return (
    <div className="stack">
      <Segmented options={RANGES} value={range} onChange={setRange} label="Bodyweight range" />
      <BodyweightPanel range={range} />
    </div>
  );
}

function personalBests(series: HistoryPoint[][]): { key: string; name: string; point: HistoryPoint }[] {
  const out: { key: string; name: string; point: HistoryPoint }[] = [];
  for (const pts of series) {
    if (!pts.length) continue;
    let best = pts[0]!;
    for (const p of pts) {
      const a = p.summary;
      const b = best.summary;
      const better =
        a.loadType === 'timed'
          ? (a.bestDurationSec ?? 0) > (b.bestDurationSec ?? 0)
          : a.topLoadKg !== null && b.topLoadKg !== null
            ? (a.loadType === 'assisted' ? a.topLoadKg < b.topLoadKg : a.topLoadKg > b.topLoadKg) || (Math.abs(a.topLoadKg - b.topLoadKg) < 0.01 && (a.repsAtTop ?? 0) > (b.repsAtTop ?? 0))
            : (a.repsAtTop ?? 0) > (b.repsAtTop ?? 0);
      if (better) best = p;
    }
    out.push({ key: best.summary.key, name: best.summary.name, point: best });
  }
  return out.sort((a, b) => (a.point.localDate < b.point.localDate ? 1 : -1));
}

function monthSummary(sessions: ReturnType<typeof useApp>['data']['sessions'], today: string): { thisMonth: number; lastMonth: number } {
  const ym = today.slice(0, 7);
  const prev = addDays(`${ym}-01`, -1).slice(0, 7);
  const count = (m: string) => sessions.filter((s) => s.state === 'completed' && s.completedLocalDate?.startsWith(m)).length;
  return { thisMonth: count(ym), lastMonth: count(prev) };
}

type Metric = 'load' | 'reps' | 'volume';

function ExerciseDetail({ exKey }: { exKey: string }) {
  const { data, today } = useApp();
  const [range, setRange] = useState<Range>('12w');
  const [metric, setMetric] = useState<Metric>('load');
  const id = useId();
  const all = exerciseHistory(data.sessions, exKey);
  const name = all[all.length - 1]?.summary.name ?? 'Exercise';
  const status = exerciseStatus(data.sessions, exKey, name, today, { checkIns: data.checkIns, profile: data.profile });
  const points = filterRange(all, range, today);
  const last = points[points.length - 1]?.summary;
  const series = points
    .map((p) => {
      const s = p.summary;
      const v = metric === 'load' ? (s.loadType === 'bodyweight' || s.loadType === 'timed' ? (s.loadType === 'timed' ? s.bestDurationSec : s.repsAtTop) : s.topLoad) : metric === 'reps' ? s.totalReps : s.volume;
      return v === null ? null : { label: shortDate(p.localDate), value: Math.round(v * 10) / 10 };
    })
    .filter((x): x is { label: string; value: number } => x !== null);
  const unit = !last ? '' : metric === 'reps' ? 'total reps' : metric === 'volume' ? `${loadSuffix(last.loadType, last.unit)} × reps` : last.loadType === 'timed' ? 'seconds' : last.loadType === 'bodyweight' ? 'reps' : loadSuffix(last.loadType, last.unit);
  const volumeMeaningful = last && (last.loadType === 'total' || last.loadType === 'per-side' || last.loadType === 'per-dumbbell');
  return (
    <div className="screen">
      <ScreenHeader back={{ href: '#/progress', label: 'Progress' }} title={name} />
      <section className="card">
        <div className="row between">
          <span className={`pill ${STATUS_CLASS[status.status]}`}>{STATUS_LABEL[status.status]}</span>
          <span className="xs muted">{all.length} record{all.length === 1 ? '' : 's'}</span>
        </div>
        <p className="small">{status.reason}</p>
      </section>
      <Segmented options={RANGES} value={range} onChange={setRange} label="Time range" />
      <Segmented
        label="Chart"
        value={metric}
        onChange={setMetric}
        options={[
          { id: 'load', label: last?.loadType === 'bodyweight' ? 'Reps' : 'Working load' },
          { id: 'reps', label: 'Total reps' },
          ...(volumeMeaningful ? [{ id: 'volume' as const, label: 'Volume' }] : []),
        ]}
      />
      {series.length >= 2 ? <LineChart points={series} title={`${name} ${metric}`} unit={unit} /> : <p className="small muted">At least two records in this range are needed for a chart.</p>}
      <table className="small data-table" aria-describedby={`${id}-cap`}>
        <caption id={`${id}-cap`} className="visually-hidden">
          Records for {name}
        </caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Best set</th>
            <th scope="col">Sets</th>
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((p) => (
            <tr key={p.sessionId}>
              <td className="num">{shortDate(p.localDate)}</td>
              <td className="num">{summaryLabel(p.summary)}</td>
              <td className="num">{p.summary.sets}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="xs faint">Week of {shortDate(weekStartOf(today))}. Volume is load × reps in this exercise’s own convention and is never compared across conventions.</p>
    </div>
  );
}
