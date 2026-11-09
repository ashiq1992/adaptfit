import { useMemo, useState } from 'react';
import { EXERCISES_BY_ID } from '../../content/exercises';
import { PROGRAMME_TEMPLATES } from '../../content/programmeLibrary';
import { defaultAnswers, evaluateTemplate } from '../../domain/guided';
import { newId } from '../../data/repo';
import type { TrainingGoal } from '../../domain/types';
import { useApp } from '../../ui/DataContext';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { GOAL_CHOICES } from '../onboarding/choices';

const DAY_FILTERS = [0, 2, 3, 4, 5] as const;

/**
 * Programme library: browse the starter routines, filter by schedule and
 * goal, preview the structure, then customise and save as a workout note.
 * Choosing a programme is occasional, so this sits behind Plan.
 */
export function LibraryScreen() {
  const { data } = useApp();
  const [days, setDays] = useState<number>(0);
  const [goal, setGoal] = useState<TrainingGoal | 'any'>('any');
  const answers = useMemo(() => defaultAnswers(data.profile, data.activeProgramme), [data.profile, data.activeProgramme]);
  const list = useMemo(
    () =>
      PROGRAMME_TEMPLATES.filter((t) => (days === 0 || t.daysPerWeek === days) && (goal === 'any' || t.goalFit[goal] >= 2)).map((t) => ({
        t,
        rec: evaluateTemplate(t, { ...answers, daysPerWeek: t.daysPerWeek }, newId),
      })),
    [days, goal, answers],
  );
  return (
    <div className="screen">
      <ScreenHeader back={{ href: '#/plan', label: 'Plan' }} title="Programmes" subtitle="Original starter routines. Pick one, adjust it, and it becomes a workout note." />
      <a href="#/library/guide" className="card card-link" data-testid="recommend-link">
        <span className="card-title">Recommend one for me</span>
        <span className="small muted">Five quick questions (goal, days, time, equipment, priorities) → a ranked shortlist with reasons.</span>
      </a>
      <div className="stack-sm">
        <div className="seg" role="radiogroup" aria-label="Days per week">
          {DAY_FILTERS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={days === d} className="seg-btn" onClick={() => setDays(d)}>
              {d === 0 ? 'Any' : `${d} days`}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="visually-hidden">Goal</span>
          <select className="select" value={goal} onChange={(e) => setGoal(e.target.value as TrainingGoal | 'any')} aria-label="Filter by goal">
            <option value="any">Any goal</option>
            {GOAL_CHOICES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {list.length === 0 && <p className="muted">No starter routine matches both filters. Try “Any days”, or write your own note.</p>}
      <ul className="stack">
        {list.map(({ t, rec }) => (
          <li key={t.id} className="card">
            <div className="card-head">
              <h2 className="card-title">{t.name}</h2>
              <span className="pill">{t.daysPerWeek} days</span>
            </div>
            <p className="small muted">{t.summary}</p>
            <p className="xs muted">
              About {rec.estimatedMinutes} min per session · {t.audience}
            </p>
            <details className="disclosure">
              <summary>Training structure</summary>
              <div className="stack-sm">
                {rec.days.map((d) => (
                  <div key={d.id}>
                    <p className="note-day-label">{d.name}</p>
                    <ul className="small">
                      {d.exercises.map((e) => (
                        <li key={e.id}>
                          {EXERCISES_BY_ID.get(e.exerciseId)?.name ?? e.name} — {e.sets} × {e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}
                          {e.durationSec ? ` ${e.durationSec} s` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="xs muted">{t.progression}</p>
              </div>
            </details>
            <a href={`#/library/guide?template=${encodeURIComponent(t.id)}`} className="btn btn-tertiary">
              Preview and customise
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
