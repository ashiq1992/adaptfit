import { useId, useMemo, useState } from 'react';
import { deleteSession } from '../../data/repo';
import { comparableKey } from '../../domain/loads';
import { sessionChanges, summarizeExercise, trainedExercises } from '../../domain/progression';
import type { WorkoutSession } from '../../domain/types';
import { completedExerciseCount, completedSets, describeDuration } from '../../domain/workout';
import { useAnnounce } from '../../ui/Announcer';
import { ChangeLabel } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { ConfirmDialog } from '../../ui/Dialog';
import { navigate } from '../../ui/hooks';
import { IconEdit, IconFilter, IconRepeat, IconTrash, IconTrophy } from '../../ui/icons';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { longDate, setLabel, summaryLabel } from '../format';
import { repeatSession } from '../train/start';
import { EditSessionDialog } from './EditSessionDialog';

export function HistoryScreen() {
  const { data } = useApp();
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exercise, setExercise] = useState('');
  const fromId = useId();
  const toId = useId();
  const exId = useId();
  const exercises = useMemo(() => trainedExercises(data.sessions), [data.sessions]);

  const list = data.completed.filter((s) => {
    const d = s.completedLocalDate ?? '';
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (exercise && !s.exercises.some((e) => comparableKey(e.exerciseId, e.loadType) === exercise && completedSets(e).length > 0)) return false;
    return true;
  });
  const filtered = !!(from || to || exercise);

  return (
    <div className="screen">
      <ScreenHeader
        back={{ href: '#/progress', label: 'Progress' }}
        title="History"
        subtitle="Completed workouts, newest first."
        actions={
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Filter history" aria-expanded={showFilters} aria-controls="hist-filters" onClick={() => setShowFilters((v) => !v)}>
            <IconFilter />
          </button>
        }
      />

      <div id="hist-filters" className="card" hidden={!showFilters}>
        <div className="filters">
          <div className="field">
            <label className="field-label" htmlFor={fromId}>
              From
            </label>
            <input id={fromId} type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={toId}>
              To
            </label>
            <input id={toId} type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={exId}>
              Exercise
            </label>
            <select id={exId} className="select" value={exercise} onChange={(e) => setExercise(e.target.value)}>
              <option value="">All exercises</option>
              {exercises.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filtered && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setFrom('');
              setTo('');
              setExercise('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {data.completed.length === 0 ? (
        <section className="card empty">
          <h2 className="card-title">No workouts yet</h2>
          <p className="muted small">Confirm a weekly update (or log a workout) and it appears here with every recorded set and how it compares.</p>
          <div className="row wrap">
            <a href="#/week" className="btn btn-primary">
              Update this week
            </a>
            <a href="#/import" className="btn btn-tertiary">
              Import past workouts
            </a>
          </div>
        </section>
      ) : list.length === 0 ? (
        <p className="muted">No workouts match these filters.</p>
      ) : (
        <ol className="stack" aria-label="Completed workouts">
          {list.map((s) => (
            <HistoryCard key={s.id} session={s} />
          ))}
        </ol>
      )}
    </div>
  );
}

function HistoryCard({ session }: { session: WorkoutSession }) {
  const { data } = useApp();
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyId = useId();
  const changes = useMemo(() => sessionChanges(data.sessions, session), [data.sessions, session]);
  const strengthSets = session.exercises.filter((e) => e.tags.includes('strength')).reduce((n, e) => n + completedSets(e).length, 0);
  const comparable = changes.filter((c) => c.comparison.kind !== 'insufficient');

  return (
    <li className="card hist-card" data-testid="history-item">
      <button type="button" className="hist-summary" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
        <span className="hist-date">{session.completedLocalDate ? longDate(session.completedLocalDate) : '—'}</span>
        <span className="pill pill-completed hist-pill">
          Completed
        </span>
        <span className="hist-name">{session.name}</span>
        <span className="small muted hist-meta">
          {completedExerciseCount(session)} exercises · {strengthSets} strength sets · {describeDuration(session)}
          {session.source === 'import' ? ' · imported' : session.source === 'legacy' ? ' · V0.1 record' : ''}
          {session.editedAt ? ' · corrected' : ''}
        </span>
        {comparable.length > 0 && (
          <span className="change-list hist-changes">
            {comparable.slice(0, 3).map((c) => (
              <ChangeLabel key={c.key} name={c.name} kind={c.comparison.kind} label={c.comparison.label} />
            ))}
          </span>
        )}
      </button>
      <div id={bodyId} className="hist-body" hidden={!open}>
        {session.exercises.map((e) => {
          const sets = completedSets(e);
          const change = changes.find((c) => c.key === comparableKey(e.exerciseId, e.loadType));
          if (sets.length === 0) {
            return e.skipped ? (
              <div key={e.key} className="hist-ex">
                <span className="small muted">{e.name} — skipped</span>
              </div>
            ) : null;
          }
          const summary = summarizeExercise(e);
          return (
            <div key={e.key} className="hist-ex">
              <div className="row between wrap">
                <h3 className="small strong">{e.name}</h3>
                {change?.isPR && (
                  <span className="pill pill-pr">
                    <IconTrophy size={12} /> PR
                  </span>
                )}
              </div>
              <div className="hist-sets">
                {sets.map((set, i) => (
                  <span key={set.id} className="set-tag">
                    {i + 1}: {setLabel(set, e.loadType, e.unit)}
                  </span>
                ))}
              </div>
              {change && (
                <p className="xs muted">
                  {change.previous ? (
                    <>
                      Previous: {summaryLabel(change.previous)} · <ChangeLabel kind={change.comparison.kind} label={change.comparison.label} />
                    </>
                  ) : (
                    'First record of this exercise — no comparison yet.'
                  )}
                </p>
              )}
              {summary?.volume != null && <p className="xs faint num">Volume: {Math.round(summary.volume)} ({e.loadType === 'per-side' ? 'kg/side' : e.unit}·reps)</p>}
            </div>
          );
        })}
        <div className="row wrap">
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setEditing(true)}>
            <IconEdit size={16} /> Edit
          </button>
          <button
            type="button"
            className="btn btn-tertiary btn-sm"
            disabled={!!data.active}
            title={data.active ? 'Finish the current workout first' : undefined}
            onClick={async () => {
              await repeatSession({ source: session, history: data.sessions, profile: data.profile, programmes: data.programmes });
              navigate('/workout');
            }}
          >
            <IconRepeat size={16} /> Repeat
          </button>
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setConfirmDelete(true)}>
            <IconTrash size={16} /> Delete
          </button>
        </div>
      </div>
      {editing && <EditSessionDialog session={session} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this workout?"
          confirmLabel="Delete workout"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteSession(session.id);
            announce('Workout deleted. Progress was recalculated.');
          }}
        >
          <p>
            {session.name} on {session.completedLocalDate} will be removed. Progress, personal bests and reviews are recalculated from the remaining history.
          </p>
        </ConfirmDialog>
      )}
    </li>
  );
}
