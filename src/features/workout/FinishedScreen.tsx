import { useMemo, useState } from 'react';
import { computeRpg } from '../../domain/rpg';
import { sessionChanges } from '../../domain/progression';
import { completedExerciseCount, completedSetCount, describeDuration } from '../../domain/workout';
import { Adventurer } from '../../ui/Adventurer';
import { ChangeLabel } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { IconTrophy } from '../../ui/icons';

export function FinishedScreen({ id }: { id: string }) {
  const { data, today, rpg } = useApp();
  const session = data.sessions.find((s) => s.id === id);
  const [feedback, setFeedback] = useState(true);

  const result = useMemo(() => {
    if (!session || session.state !== 'completed') return null;
    const without = computeRpg({ sessions: data.sessions.filter((s) => s.id !== id), checkIns: data.checkIns, recommendations: data.recommendations, weekPlans: data.weekPlans, programme: data.activeProgramme, reviewedWeeks: data.reviewedWeeks, today });
    const gained = rpg.events.filter((e) => e.key.includes(`:${id}`) || !without.events.some((w) => w.key === e.key));
    return { gained, xp: gained.reduce((n, e) => n + e.xp, 0), levelUp: rpg.level.level > without.level.level, changes: sessionChanges(data.sessions, session) };
  }, [session, data, id, rpg, today]);

  if (!session || session.state !== 'completed' || !result) {
    return (
      <div className="screen">
        <h1 tabIndex={-1}>Workout not found</h1>
        <p className="muted">This workout isn't in your completed history.</p>
        <a href="#/train" className="btn btn-primary">
          Go to Train
        </a>
      </div>
    );
  }
  const prs = result.changes.filter((c) => c.isPR);

  return (
    <div className="screen">
      <div>
        <span className="eyebrow">Workout complete</span>
        <h1 tabIndex={-1}>{session.name}</h1>
      </div>
      <div className="grid-2">
        <div className="stack">
          {data.profile.gamification && feedback && (
            <section className="card card-amber celebrate" aria-labelledby="fb-title">
              <div className="row" style={{ alignItems: 'center', gap: 16 }}>
                <div className="scene-frame" style={{ width: 96, height: 96 }}>
                  <Adventurer styleId={data.profile.character.style} hidden={data.profile.character.hiddenLayers} level={rpg.level.level} size={84} decorative />
                </div>
                <div className="grow stack-sm">
                  <h2 id="fb-title" className="card-title">
                    {result.levelUp ? `Level ${rpg.level.level} reached!` : 'Nice work!'}
                  </h2>
                  <span className="xp-pop amber strong" style={{ fontSize: 'var(--fs-xl)' }} data-testid="xp-earned">
                    +{result.xp} XP
                  </span>
                  <span className="xs muted num">
                    Lv. {rpg.level.level} · {rpg.level.xpIntoLevel}/{rpg.level.xpForNext} XP
                  </span>
                </div>
              </div>
              <ul className="bullet-list">
                {result.gained.map((e) => (
                  <li key={e.key}>
                    {e.label} (+{e.xp})
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFeedback(false)} aria-label="Dismiss character feedback">
                Dismiss
              </button>
            </section>
          )}
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
                <span className="metric-val num" style={{ fontSize: 'var(--fs-md)' }}>
                  {describeDuration(session)}
                </span>
                <span className="metric-label">Duration</span>
              </div>
            </div>
          </section>
        </div>
        <section className="card" aria-labelledby="changes-title">
          <h2 id="changes-title" className="card-title">
            Compared with last time
          </h2>
          {prs.length > 0 && (
            <p className="row amber small strong">
              <IconTrophy size={18} /> {prs.length} personal record{prs.length === 1 ? '' : 's'}: {prs.map((p) => p.name).join(', ')}
            </p>
          )}
          <ul className="change-rows">
            {result.changes.map((c) => (
              <li key={c.key}>
                <span className="small">{c.name}</span>
                <ChangeLabel kind={c.comparison.kind} label={c.comparison.kind === 'insufficient' ? 'First record' : c.comparison.label} />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="row wrap">
        <a href="#/train/history" className="btn btn-primary btn-grow">
          View history
        </a>
        <a href="#/progress" className="btn btn-secondary btn-grow">
          Progress
        </a>
        <a href="#/train" className="btn btn-tertiary btn-grow">
          Back to Train
        </a>
      </div>
    </div>
  );
}
