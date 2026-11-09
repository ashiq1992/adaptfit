import { useMemo } from 'react';
import { sessionChanges } from '../../domain/progression';
import { completedExerciseCount, completedSetCount, describeDuration } from '../../domain/workout';
import { ChangeLabel } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { IconTrophy } from '../../ui/icons';

/** After an optional live log: a plain summary against the previous comparable records. */
export function FinishedScreen({ id }: { id: string }) {
  const { data } = useApp();
  const session = data.sessions.find((s) => s.id === id);
  const changes = useMemo(() => (session && session.state === 'completed' ? sessionChanges(data.sessions, session) : null), [session, data.sessions]);

  if (!session || session.state !== 'completed' || !changes) {
    return (
      <div className="screen">
        <h1 tabIndex={-1}>Workout not found</h1>
        <p className="muted">This workout isn't in your recorded history.</p>
        <a href="#/plan" className="btn btn-primary">
          Go to Plan
        </a>
      </div>
    );
  }
  const prs = changes.filter((c) => c.isPR);

  return (
    <div className="screen">
      <div>
        <span className="eyebrow">Workout saved</span>
        <h1 tabIndex={-1}>{session.name}</h1>
      </div>
      <section className="card" aria-labelledby="summary-title">
        <h2 id="summary-title" className="card-title">
          What you did
        </h2>
        <div className="metric-tiles">
          <div className="metric-tile">
            <span className="metric-val num">{completedExerciseCount(session)}</span>
            <span className="metric-label">Exercises</span>
          </div>
          <div className="metric-tile">
            <span className="metric-val num">{completedSetCount(session)}</span>
            <span className="metric-label">Completed sets</span>
          </div>
          <div className="metric-tile">
            <span className="metric-val metric-val-sm num">
              {describeDuration(session)}
            </span>
            <span className="metric-label">Duration</span>
          </div>
        </div>
      </section>
      <section className="card" aria-labelledby="changes-title">
        <h2 id="changes-title" className="card-title">
          Compared with last time
        </h2>
        {prs.length > 0 && (
          <p className="row amber small strong">
            <IconTrophy size={18} /> New best: {prs.map((p) => p.name).join(', ')}
          </p>
        )}
        <ul className="change-rows">
          {changes.map((c) => (
            <li key={c.key}>
              <span className="small">{c.name}</span>
              <ChangeLabel kind={c.comparison.kind} label={c.comparison.kind === 'insufficient' ? 'First record' : c.comparison.label} />
            </li>
          ))}
        </ul>
        <p className="xs muted">This workout also appears in this week’s update, counted once.</p>
      </section>
      <div className="row wrap">
        <a href="#/plan" className="btn btn-primary btn-grow">
          Back to Plan
        </a>
        <a href="#/progress" className="btn btn-tertiary btn-grow">
          Progress
        </a>
      </div>
    </div>
  );
}
