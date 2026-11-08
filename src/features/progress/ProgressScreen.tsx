import { useId, useMemo, useState } from 'react';
import { targetForWeek } from '../../domain/coach';
import { comparableKey, loadSuffix } from '../../domain/loads';
import { exerciseHistory, filterRange, type HistoryPoint, periodSummary, type Range, trainedExercises, trend, weeklyConsistency } from '../../domain/progression';
import { LineChart, WeekBars } from '../../ui/Charts';
import { ChangeLabel, Segmented, Tabs } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { IconCalendar, IconFlame, IconTrain, IconTrophy } from '../../ui/icons';
import { CharacterCard } from '../journey/CharacterCard';
import { BodyweightPanel } from './BodyweightPanel';
import { shortDate, summaryLabel } from '../format';

const RANGES = [
  { id: '4w', label: '4W' },
  { id: '8w', label: '8W' },
  { id: '12w', label: '12W' },
  { id: 'all', label: 'All' },
] as const;
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'exercises', label: 'Exercises' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'body', label: 'Bodyweight' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function ProgressScreen() {
  const { data, today, rpg } = useApp();
  const [tab, setTab] = useState<TabId>('overview');
  const [range, setRange] = useState<Range>('8w');
  const exercises = useMemo(() => trainedExercises(data.sessions), [data.sessions]);
  const priority = useMemo(() => new Set(data.activeProgramme?.days.flatMap((d) => d.exercises.filter((e) => e.priority).map((e) => comparableKey(e.exerciseId, e.loadType))) ?? []), [data.activeProgramme]);
  const defaultKey = exercises.find((e) => priority.has(e.key) && e.sessions >= 2)?.key ?? [...exercises].sort((a, b) => b.sessions - a.sessions)[0]?.key ?? '';
  const [selected, setSelected] = useState('');
  const key = selected || defaultKey;

  return (
    <div className="screen">
      <div className="screen-head">
        <h1 tabIndex={-1}>Progress</h1>
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Progress views" idBase="progress" />
      <Segmented options={RANGES} value={range} onChange={setRange} label="Time range" />
      <div id="progress-panel" role="tabpanel" aria-labelledby={`progress-tab-${tab}`} className="stack">
        {tab === 'overview' && <Overview range={range} exKey={key} onSelect={setSelected} exercises={exercises} />}
        {tab === 'exercises' && <ExerciseDetail range={range} exKey={key} onSelect={setSelected} exercises={exercises} />}
        {tab === 'consistency' && <Consistency range={range} />}
        {tab === 'body' && <BodyweightPanel range={range} />}
      </div>
      {data.profile.gamification && tab === 'overview' && (
        <div className="stack-sm">
          <CharacterCard rpg={rpg} character={data.profile.character} compact />
          <a href="#/journey" className="link-btn">
            Open Journey for achievements →
          </a>
        </div>
      )}
      <p className="xs faint">Comparisons only use the same exercise recorded with the same loading convention. Today: {today}.</p>
    </div>
  );
}

function ExercisePicker({ exercises, value, onSelect }: { exercises: ReturnType<typeof trainedExercises>; value: string; onSelect: (k: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label className="visually-hidden" htmlFor={id}>
        Exercise
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onSelect(e.target.value)}>
        {exercises.map((e) => (
          <option key={e.key} value={e.key}>
            {e.name}
            {e.loadType === 'unspecified' ? ' (V0.1, loading not specified)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function chartPoints(points: HistoryPoint[]) {
  return points.map((p) => {
    const s = p.summary;
    const value = s.loadType === 'timed' ? (s.bestDurationSec ?? 0) : s.topLoad !== null && s.loadType !== 'bodyweight' ? s.topLoad : (s.repsAtTop ?? 0);
    const tip = s.loadType === 'timed' ? `${value}s` : s.topLoad !== null && s.loadType !== 'bodyweight' ? `${s.topLoad}×${s.repsAtTop ?? 0}` : `${s.repsAtTop} reps`;
    return { label: shortDate(p.localDate), value, tip };
  });
}

function chartUnit(points: HistoryPoint[]): string {
  const s = points[points.length - 1]?.summary;
  if (!s) return '';
  if (s.loadType === 'timed') return 'seconds';
  if (s.topLoad === null || s.loadType === 'bodyweight') return 'reps';
  return loadSuffix(s.loadType, s.unit);
}

function Overview({ range, exKey, onSelect, exercises }: { range: Range; exKey: string; onSelect: (k: string) => void; exercises: ReturnType<typeof trainedExercises> }) {
  const { data, today } = useApp();
  const summary = periodSummary(data.sessions, range, today);
  const points = filterRange(exerciseHistory(data.sessions, exKey), range, today);
  const t = trend(points);
  const first = points[0]?.summary;
  const last = points[points.length - 1]?.summary;
  const pct = first && last && first.topLoadKg && last.topLoadKg && first.loadType !== 'assisted' && first.topLoadKg > 0 ? ((last.topLoadKg - first.topLoadKg) / first.topLoadKg) * 100 : null;
  const weeks = weeklyConsistency(data.sessions, today, range === '4w' ? 4 : range === '12w' ? 12 : 8, (ws) => targetForWeek(data.activeProgramme, data.weekPlans, ws));
  const planned = weeks.filter((w) => w.target > 0);
  const consistency = planned.length ? Math.round((planned.reduce((n, w) => n + Math.min(w.completed, w.target), 0) / planned.reduce((n, w) => n + w.target, 0)) * 100) : null;
  const changes = exercises
    .map((e) => ({ e, t: trend(filterRange(exerciseHistory(data.sessions, e.key), range, today)) }))
    .filter((x): x is { e: typeof x.e; t: NonNullable<typeof x.t> } => x.t !== null);

  if (data.completed.length === 0) {
    return (
      <section className="card empty">
        <h2 className="card-title">No training data yet</h2>
        <p className="small muted">Complete or import a few workouts. Progress compares your own records — nothing is estimated from population averages.</p>
        <a href="#/train" className="btn btn-primary">
          Go to Train
        </a>
      </section>
    );
  }

  return (
    <>
      <div className="metric-tiles">
        <div className="metric-tile">
          <IconTrain size={18} />
          <span className="metric-val num" data-testid="metric-sessions">
            {summary.sessions}
          </span>
          <span className="metric-label">Workouts</span>
        </div>
        <div className="metric-tile">
          <IconFlame size={18} />
          <span className="metric-val num">{summary.completedSets}</span>
          <span className="metric-label">Sets</span>
        </div>
        <div className="metric-tile">
          <IconTrophy size={18} />
          <span className="metric-val num">{summary.prs}</span>
          <span className="metric-label">PRs</span>
        </div>
      </div>
      <section className="card" aria-labelledby="strength-title">
        <div className="row between">
          <h2 id="strength-title" className="card-title">
            Strength progress
          </h2>
          <span className="xs muted">{consistency !== null ? `${consistency}% consistency` : ''}</span>
        </div>
        {exercises.length > 0 && <ExercisePicker exercises={exercises} value={exKey} onSelect={onSelect} />}
        {points.length >= 2 && t ? (
          <>
            <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
              <span className="big-change num">{pct !== null && Math.abs(pct) >= 0.05 ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : t.label}</span>
              <span className="small muted">{pct !== null && Math.abs(pct) >= 0.05 ? `top load vs ${shortDate(t.first.localDate)}` : `vs ${shortDate(t.first.localDate)}`}</span>
            </div>
            <LineChart points={chartPoints(points)} title={`${last!.name} top set`} unit={chartUnit(points)} />
            <div className="metric-tiles">
              <div className="metric-tile">
                <span className="metric-label">Top set</span>
                <span className="strong small num">{summaryLabel(last!)}</span>
              </div>
              <div className="metric-tile">
                <span className="metric-label">Reps</span>
                <span className="strong small num">
                  {first!.repsAtTop ?? '—'} → {last!.repsAtTop ?? '—'}
                </span>
              </div>
              <div className="metric-tile">
                <span className="metric-label">Est. 1RM*</span>
                <span className="strong small num">{points[points.length - 1]!.e1rm !== null ? `~${points[points.length - 1]!.e1rm}` : 'n/a'}</span>
              </div>
            </div>
            <p className="xs faint">*Estimated one-rep max (Epley formula), in the exercise's own loading convention. An estimate, not a measured lift.</p>
          </>
        ) : (
          <p className="small muted">Not enough data in this range. At least two sessions of the same exercise are needed to show a trend.</p>
        )}
      </section>
      <section className="card" aria-labelledby="changes-title">
        <h2 id="changes-title" className="card-title">
          Key changes <span className="xs muted">(first vs latest in range)</span>
        </h2>
        {changes.length === 0 ? (
          <p className="small muted">No exercise has two or more sessions in this range yet.</p>
        ) : (
          <ul className="change-rows">
            {changes.map(({ e, t: tr }) => (
              <li key={e.key}>
                <span className="small">{e.name}</span>
                <ChangeLabel kind={tr.kind} label={tr.label} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

type Metric = 'load' | 'reps' | 'e1rm' | 'volume';

function ExerciseDetail({ range, exKey, onSelect, exercises }: { range: Range; exKey: string; onSelect: (k: string) => void; exercises: ReturnType<typeof trainedExercises> }) {
  const { data, today } = useApp();
  const [metric, setMetric] = useState<Metric>('load');
  const points = filterRange(exerciseHistory(data.sessions, exKey), range, today);
  if (exercises.length === 0) return <p className="muted">No exercises recorded yet.</p>;
  const last = points[points.length - 1]?.summary;
  const series = points
    .map((p) => {
      const s = p.summary;
      const v = metric === 'load' ? s.topLoad : metric === 'reps' ? s.repsAtTop : metric === 'e1rm' ? p.e1rm : s.volume;
      return v === null ? null : { label: shortDate(p.localDate), value: Math.round(v * 10) / 10 };
    })
    .filter((x): x is { label: string; value: number } => x !== null);
  const unit = last ? (metric === 'reps' ? 'reps' : loadSuffix(last.loadType, last.unit)) : '';
  return (
    <section className="card">
      <ExercisePicker exercises={exercises} value={exKey} onSelect={onSelect} />
      <Segmented
        label="Metric"
        value={metric}
        onChange={setMetric}
        options={[
          { id: 'load', label: 'Top load' },
          { id: 'reps', label: 'Reps' },
          { id: 'e1rm', label: 'Est. 1RM' },
          { id: 'volume', label: 'Volume' },
        ]}
      />
      {series.length >= 2 ? (
        <LineChart points={series} title={`${last?.name ?? ''} ${metric}`} unit={unit} />
      ) : (
        <p className="small muted">{metric === 'e1rm' ? 'Estimated 1RM needs loaded sets of 12 reps or fewer in at least two sessions.' : 'Not enough data for this metric in the selected range.'}</p>
      )}
      <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption className="visually-hidden">Sessions</caption>
        <thead>
          <tr className="muted xs" style={{ textAlign: 'left' }}>
            <th scope="col">Date</th>
            <th scope="col">Top set</th>
            <th scope="col">Sets</th>
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((p) => (
            <tr key={p.sessionId} style={{ borderTop: '1px solid var(--border)' }}>
              <td className="num" style={{ padding: '6px 0' }}>
                {shortDate(p.localDate)}
              </td>
              <td className="num">{summaryLabel(p.summary)}</td>
              <td className="num">{p.summary.sets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Consistency({ range }: { range: Range }) {
  const { data, today } = useApp();
  const n = range === '4w' ? 4 : range === '8w' ? 8 : range === '12w' ? 12 : 16;
  const weeks = weeklyConsistency(data.sessions, today, n, (ws) => targetForWeek(data.activeProgramme, data.weekPlans, ws));
  const planned = weeks.filter((w) => w.target > 0);
  const met = planned.filter((w) => w.met).length;
  const freq = trainedExercises(data.sessions)
    .map((e) => ({ e, count: filterRange(exerciseHistory(data.sessions, e.key), range, today).length }))
    .filter((x) => x.count > 0);
  return (
    <>
      <section className="card">
        <div className="row between">
          <h2 className="card-title">Planned vs completed</h2>
          <span className="pill num">{planned.length ? `${met}/${planned.length} weeks met` : 'No plan'}</span>
        </div>
        <WeekBars title="Sessions per week" weeks={weeks.map((w) => ({ label: shortDate(w.weekStart), completed: w.completed, target: w.target }))} />
        <p className="xs muted">
          <IconCalendar size={12} /> Dashed outline = planned sessions (programme or approved adjusted week). Missed weeks are shown, not penalised.
        </p>
      </section>
      <section className="card">
        <h2 className="card-title">Exercise frequency</h2>
        {freq.length === 0 ? (
          <p className="small muted">No sessions in this range.</p>
        ) : (
          <ul className="change-rows">
            {freq.map(({ e, count }) => (
              <li key={e.key}>
                <span className="small">{e.name}</span>
                <span className="small muted num">
                  {count} session{count === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
