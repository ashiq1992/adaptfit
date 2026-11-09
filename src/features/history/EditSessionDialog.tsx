import { useId, useState } from 'react';
import { correctSession, newId } from '../../data/repo';
import { isLocalDate } from '../../domain/dates';
import { loadSuffix, usesLoad } from '../../domain/loads';
import { parseLoad, parseMinutes, parsePositiveInt } from '../../domain/logging';
import type { SessionExercise, WorkoutSession } from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { Dialog } from '../../ui/Dialog';
import { IconPlus, IconTrash } from '../../ui/icons';

interface DraftSet {
  id: string;
  load: string;
  measure: string;
}

/** Correct a completed workout. Trends, personal bests and reviews recalculate from the saved record. */
export function EditSessionDialog({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const announce = useAnnounce();
  const dateId = useId();
  const minId = useId();
  const [date, setDate] = useState(session.completedLocalDate ?? '');
  const [duration, setDuration] = useState<'keep' | 'manual' | 'not-recorded'>('keep');
  const [minutes, setMinutes] = useState(session.durationSec ? String(Math.round(session.durationSec / 60)) : '');
  const [drafts, setDrafts] = useState<Record<string, DraftSet[]>>(() =>
    Object.fromEntries(
      session.exercises.map((e) => [e.key, e.sets.filter((s) => s.completed).map((s) => ({ id: s.id, load: s.load === null ? '' : String(s.load), measure: String((e.loadType === 'timed' ? s.durationSec : s.reps) ?? '') }))]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: string, i: number, patch: Partial<DraftSet>) => setDrafts((d) => ({ ...d, [key]: d[key]!.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const save = async () => {
    setError(null);
    if (!isLocalDate(date)) return setError('Enter a valid date.');
    const exercises: SessionExercise[] = [];
    for (const e of session.exercises) {
      const sets = [];
      for (const [i, d] of (drafts[e.key] ?? []).entries()) {
        const measure = parsePositiveInt(d.measure, e.loadType === 'timed' ? 3600 : 500, e.loadType === 'timed' ? 'seconds' : 'reps');
        if (!measure.ok) return setError(`${e.name}, set ${i + 1}: ${measure.error}`);
        const load = usesLoad(e.loadType) ? parseLoad(d.load) : { ok: true as const, value: null };
        if (!load.ok) return setError(`${e.name}, set ${i + 1}: ${load.error}`);
        const original = e.sets.find((s) => s.id === d.id);
        sets.push({
          id: d.id,
          load: load.value,
          reps: e.loadType === 'timed' ? null : measure.value,
          durationSec: e.loadType === 'timed' ? measure.value : null,
          rir: original?.rir ?? null,
          completed: true,
          completedAt: original?.completedAt ?? session.completedAt ?? clock.now().toISOString(),
          prefill: original?.prefill ?? ('none' as const),
        });
      }
      exercises.push({ ...e, sets });
    }
    let dur: Parameters<typeof correctSession>[1]['duration'] = { source: 'keep' };
    if (duration === 'manual') {
      const m = parseMinutes(minutes);
      if (!m.ok) return setError(m.error);
      dur = { source: 'manual', minutes: m.value };
    } else if (duration === 'not-recorded') dur = { source: 'not-recorded' };
    setBusy(true);
    try {
      await correctSession(session.id, { exercises, duration: dur, localDate: date }, clock.now());
      announce('Correction saved. Progress recalculated.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Edit ${session.name}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-tertiary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            Save correction
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor={dateId}>
          Date
        </label>
        <input id={dateId} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {session.exercises.map((e) => (
        <fieldset key={e.key} className="stack-sm">
          <legend className="field-label">
            {e.name} <span className="faint xs">({e.loadType === 'timed' ? 'seconds' : usesLoad(e.loadType) ? `${loadSuffix(e.loadType, e.unit)} × reps` : 'reps'})</span>
          </legend>
          {(drafts[e.key] ?? []).map((d, i) => (
            <div key={d.id} className="row">
              <span className="set-num num">
                {i + 1}
              </span>
              {usesLoad(e.loadType) && <input className="input input-num" aria-label={`${e.name} set ${i + 1} load (${loadSuffix(e.loadType, e.unit)})`} inputMode="decimal" value={d.load} onChange={(ev) => update(e.key, i, { load: ev.target.value })} />}
              <input className="input input-num" aria-label={`${e.name} set ${i + 1} ${e.loadType === 'timed' ? 'seconds' : 'reps'}`} inputMode="numeric" value={d.measure} onChange={(ev) => update(e.key, i, { measure: ev.target.value })} />
              <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${e.name} set ${i + 1}`} onClick={() => setDrafts((x) => ({ ...x, [e.key]: x[e.key]!.filter((_, j) => j !== i) }))}>
                <IconTrash size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="link-btn xs"
            onClick={() => {
              const last = drafts[e.key]?.[drafts[e.key]!.length - 1];
              setDrafts((x) => ({ ...x, [e.key]: [...(x[e.key] ?? []), { id: newId(), load: last?.load ?? '', measure: last?.measure ?? '' }] }));
            }}
          >
            <IconPlus size={14} /> Add set
          </button>
        </fieldset>
      ))}
      <fieldset className="field">
        <legend className="field-label">Duration</legend>
        <div className="choices choices-chips">
          {(
            [
              ['keep', 'Keep as is'],
              ['manual', 'Enter minutes'],
              ['not-recorded', 'Not recorded'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="choice">
              <input type="radio" name="edit-dur" checked={duration === v} onChange={() => setDuration(v)} />
              <span className="choice-body">
                <span className="choice-label">{l}</span>
              </span>
            </label>
          ))}
        </div>
        {duration === 'manual' && (
          <>
            <label className="field-hint" htmlFor={minId}>
              Minutes
            </label>
            <input id={minId} className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </>
        )}
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
