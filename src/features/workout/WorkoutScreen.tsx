import { useEffect, useId, useRef, useState } from 'react';
import { discardSession, finishSession, newId, updateActiveSession } from '../../data/repo';
import { LOAD_TYPE_LABEL, loadStep, loadSuffix, usesLoad } from '../../domain/loads';
import { MAX_DURATION_SEC, MAX_LOAD, MAX_REPS, parseMinutes } from '../../domain/logging';
import { XP } from '../../domain/rpg';
import type { SessionExercise, WorkoutSession } from '../../domain/types';
import * as W from '../../domain/workout';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { Progress, Stepper } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { ConfirmDialog, Dialog } from '../../ui/Dialog';
import { navigate, useNow } from '../../ui/hooks';
import { IconBack, IconCheck, IconMore, IconPause, IconPlay, IconPlus, IconTrash } from '../../ui/icons';
import { clockTime, plural, repRange, restLabel, setLabel, shortDate } from '../format';

type SaveState = { status: 'idle' | 'saving' | 'saved' } | { status: 'error'; message: string; retry: () => Promise<boolean> };

export function WorkoutScreen() {
  const { data } = useApp();
  if (!data.active) {
    return (
      <div className="screen">
        <h1 tabIndex={-1}>No workout in progress</h1>
        <p className="muted">Start your next session from Train.</p>
        <a href="#/train" className="btn btn-primary">
          Go to Train
        </a>
      </div>
    );
  }
  return <Workout key={data.active.id} session={data.active} />;
}

function Workout({ session }: { session: WorkoutSession }) {
  const { data } = useApp();
  const announce = useAnnounce();
  const now = useNow(1000);
  const [save, setSave] = useState<SaveState>({ status: 'idle' });
  const [selected, setSelected] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const exercises = session.exercises;
  const position = Math.min(session.position, Math.max(0, exercises.length - 1));
  const ex = exercises[position];
  const done = W.completedSetCount(session);
  const planned = W.plannedSetCount(session);
  const firstOpen = ex?.sets.find((s) => !s.completed) ?? null;
  const selectedSet = ex?.sets.find((s) => s.id === selected) ?? firstOpen ?? ex?.sets[0] ?? null;

  /** Persist a transition; on failure keep the last committed session and offer a retry. */
  const run = async (change: (s: WorkoutSession) => WorkoutSession, message?: string): Promise<boolean> => {
    setSave({ status: 'saving' });
    const attempt = async (): Promise<boolean> => {
      try {
        await updateActiveSession(session.id, change);
        setSave({ status: 'saved' });
        if (message) announce(message);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save.';
        setSave({ status: 'error', message: msg, retry: attempt });
        announce(`Not saved. ${msg}`);
        return false;
      }
    };
    return attempt();
  };

  const toggleSet = (e: SessionExercise, setId: string, index: number) => {
    const set = e.sets.find((s) => s.id === setId)!;
    if (set.completed) {
      void run((s) => W.uncompleteSet(s, e.key, setId, clock.now()), `Set ${index + 1} marked not done.`);
      return;
    }
    if (!W.setValuesValid(set, e.loadType)) {
      setSelected(setId);
      setSave({ status: 'error', message: `Set ${index + 1}: enter valid values first.`, retry: async () => true });
      return;
    }
    const remaining = e.sets.filter((s) => !s.completed && s.id !== setId);
    const advance = remaining.length === 0 && position < exercises.length - 1;
    void run(
      (s) => {
        let next = W.completeSet(s, e.key, setId, clock.now());
        if (advance) next = W.setPosition(next, position + 1, clock.now());
        return next;
      },
      `Set ${index + 1} of ${e.name} done.${advance ? ` Next: ${exercises[position + 1]!.name}.` : ''}`,
    );
    setSelected(remaining[0]?.id ?? null);
  };

  const goTo = (i: number) => {
    setSelected(null);
    void run((s) => W.setPosition(s, i, clock.now()));
  };

  const primary = (() => {
    if (ex && firstOpen && !ex.skipped) {
      const idx = ex.sets.indexOf(firstOpen);
      return { label: `Complete set ${idx + 1}`, action: () => toggleSet(ex, firstOpen.id, idx) };
    }
    if (position < exercises.length - 1) return { label: 'Next exercise', action: () => goTo(position + 1) };
    return { label: 'Finish workout', action: () => setFinishOpen(true) };
  })();

  const elapsed = W.activeElapsedSec(session, now);
  const prev = ex ? W.previousPerformance(data.sessions, ex.exerciseId, ex.loadType, { excludeSessionId: session.id }) : null;
  const target = ex ? W.suggestTarget(ex.target, prev, ex.loadType) : null;

  return (
    <div className="screen workout">
      <div className="wk-top">
        <a href="#/train" className="btn btn-ghost btn-icon" aria-label="Back to Train (workout stays saved)">
          <IconBack />
        </a>
        <h1 tabIndex={-1} className="wk-title">
          {session.name}
        </h1>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Workout options" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
          <IconMore />
        </button>
      </div>

      <div className={`timer ${session.pausedAt ? 'paused' : ''}`}>
        <div>
          <span className="timer-value" data-testid="elapsed" aria-label={`Elapsed ${clockTime(elapsed)}${session.pausedAt ? ', paused' : ''}`}>
            {clockTime(elapsed)}
          </span>
          {session.pausedAt && <span className="xs amber"> Paused</span>}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          aria-label={session.pausedAt ? 'Resume workout timer' : 'Pause workout timer'}
          onClick={() => void run((s) => (s.pausedAt ? W.resume(s, clock.now()) : W.pause(s, clock.now())), session.pausedAt ? 'Workout resumed.' : 'Workout paused.')}
        >
          {session.pausedAt ? <IconPlay size={18} /> : <IconPause />}
        </button>
      </div>

      <div className="stack-sm">
        <div className="row between small">
          <span className="teal strong num">
            Exercise {position + 1} of {exercises.length}
          </span>
          <span className="muted num" data-testid="sets-done">
            {done}/{planned} sets
          </span>
        </div>
        <Progress value={done} max={Math.max(planned, done)} label="Sets completed" />
        <SaveStatus save={save} />
      </div>

      {session.restStartedAt && <RestBanner session={session} onDismiss={() => void run((s) => W.clearRest(s, clock.now()))} />}

      <div className="grid-2">
        {ex && (
          <section className="card ex-card" aria-labelledby="ex-name">
            <div className="ex-head">
              <div style={{ minWidth: 0 }}>
                <h2 id="ex-name" className="ex-name" data-testid="exercise-name">
                  {ex.name}
                </h2>
                <p className="small muted num">
                  {ex.target.sets} sets · {ex.loadType === 'timed' ? `${ex.target.durationSec ?? '—'} s` : repRange(ex.target.repMin, ex.target.repMax)} · {restLabel(ex.target.restSec)}
                </p>
                <p className="xs faint">{LOAD_TYPE_LABEL[ex.loadType]}{usesLoad(ex.loadType) ? ` (${loadSuffix(ex.loadType, ex.unit)})` : ''}</p>
              </div>
              {ex.priority && <span className="pill pill-pr">★ Priority</span>}
            </div>

            <div className="keylift">
              <div className="keylift-box">
                <div className="label">Last session{prev?.localDate ? ` · ${shortDate(prev.localDate)}` : ''}</div>
                <div className="value num">{prev ? `${setLabel(prev.sets[0]!, ex.loadType, prev.unit)}${prev.sets.length > 1 ? ` (${prev.sets.length} sets)` : ''}` : 'No record yet'}</div>
              </div>
              <div className="keylift-box target">
                <div className="label">Target</div>
                <div className="value num">
                  {target && target.kind === 'add-rep' && prev ? setLabel({ ...prev.sets[0]!, reps: target.reps }, ex.loadType, prev.unit) : target?.kind === 'consider-load' ? 'Small load increase' : ex.loadType === 'timed' ? `${ex.target.durationSec ?? '—'} s` : repRange(ex.target.repMin, ex.target.repMax)}
                </div>
              </div>
            </div>
            {target?.text && <p className="xs muted">{target.text}</p>}

            {ex.skipped ? (
              <div className="status-banner amber">
                <IconCheck />
                <div className="row between wrap">
                  <span className="small">Skipped. Completing a set will un-skip it.</span>
                  <button type="button" className="btn btn-tertiary btn-sm" onClick={() => void run((s) => W.setSkipped(s, ex.key, false, clock.now()), `${ex.name} restored.`)}>
                    Undo skip
                  </button>
                </div>
              </div>
            ) : null}

            <ol className="set-table" aria-label={`Sets for ${ex.name}`}>
              {ex.sets.map((set, i) => {
                const isSel = selectedSet?.id === set.id;
                return (
                  <li key={set.id} className={`set-row ${set.completed ? 'is-done' : ''} ${isSel ? 'is-selected' : ''}`} data-testid="set-row">
                    <button
                      type="button"
                      className="set-check"
                      aria-pressed={set.completed}
                      aria-label={set.completed ? `Set ${i + 1} done (${setLabel(set, ex.loadType, ex.unit)}) — mark not done` : `Complete set ${i + 1}: ${setLabel(set, ex.loadType, ex.unit)}`}
                      onClick={() => toggleSet(ex, set.id, i)}
                    >
                      <span className="ring">{set.completed && <IconCheck size={16} />}</span>
                    </button>
                    <span className="set-num num">{i + 1}</span>
                    <button type="button" className="set-val" aria-expanded={isSel} onClick={() => setSelected(set.id)}>
                      <span className="visually-hidden">Edit set {i + 1}: </span>
                      {setLabel(set, ex.loadType, ex.unit)}
                      <span className="sub">{set.completed ? 'Done' : set.prefill === 'previous' ? 'From last session — not done yet' : set.prefill === 'planned' ? 'Planned starting weight — not done yet' : set.prefill === 'target' ? 'Target reps — not done yet' : 'Not done yet'}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {selectedSet && (
              <SetEditor
                key={selectedSet.id + (selectedSet.completed ? 'c' : '')}
                ex={ex}
                setId={selectedSet.id}
                index={ex.sets.indexOf(selectedSet)}
                onChange={(patch) => run((s) => W.updateSetValues(s, ex.key, selectedSet.id, patch, clock.now()))}
                onDelete={
                  ex.sets.length > 1
                    ? () => {
                        setSelected(null);
                        void run((s) => W.deleteSet(s, ex.key, selectedSet.id, clock.now()), 'Set removed.');
                      }
                    : undefined
                }
              />
            )}

            <div className="row wrap">
              <button type="button" className="btn btn-tertiary btn-grow" onClick={() => void run((s) => W.addSet(s, ex.key, newId, clock.now()), 'Set added.')}>
                <IconPlus size={18} /> Add set
              </button>
              {!ex.skipped && (
                <button type="button" className="btn btn-ghost btn-grow" onClick={() => void run((s) => W.setSkipped(s, ex.key, true, clock.now()), `${ex.name} skipped.`)}>
                  Skip exercise
                </button>
              )}
            </div>
          </section>
        )}

        <aside className="card sticky-col" aria-label="Exercises in this workout">
          <h2 className="card-title">Exercises</h2>
          <ol className="up-next stack-sm">
            {exercises.map((e, i) => {
              const n = W.completedSets(e).length;
              const complete = n >= e.target.sets;
              return (
                <li key={e.key}>
                  <button type="button" aria-current={i === position ? 'step' : undefined} onClick={() => goTo(i)}>
                    <span className={`idx ${complete ? 'done' : ''} ${e.skipped ? 'skipped' : ''}`} aria-hidden="true">
                      {complete ? <IconCheck size={16} /> : i + 1}
                    </span>
                    <span className="small">
                      {e.name}
                      {e.skipped && <span className="xs muted"> · skipped</span>}
                    </span>
                    <span className="xs muted num">
                      {n}/{e.target.sets}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {data.profile.gamification && (
            <span className="xp-hint" title="XP is awarded once, when you finish with at least one completed set.">
              ★ +{XP.workout}
              {session.source === 'programme' ? ` (+${XP.planned} planned)` : ''} XP on finish
            </span>
          )}
        </aside>
      </div>

      <div className="action-bar" role="region" aria-label="Workout actions">
        <button type="button" className="btn btn-tertiary" onClick={() => setFinishOpen(true)}>
          Finish
        </button>
        <button type="button" className="btn btn-primary btn-grow btn-lg" onClick={primary.action}>
          {primary.label === 'Finish workout' ? <IconCheck /> : null} {primary.label}
        </button>
      </div>

      {menuOpen && (
        <Dialog
          title="Workout options"
          onClose={() => setMenuOpen(false)}
          actions={
            <button type="button" className="btn btn-tertiary" onClick={() => setMenuOpen(false)} data-autofocus>
              Close
            </button>
          }
        >
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              setMenuOpen(false);
              void run((s) => (s.pausedAt ? W.resume(s, clock.now()) : W.pause(s, clock.now())), session.pausedAt ? 'Workout resumed.' : 'Workout paused.');
            }}
          >
            {session.pausedAt ? 'Resume workout' : 'Pause workout'}
          </button>
          <p className="xs muted">Your draft is saved after every change. You can leave and come back at any time.</p>
          <button
            type="button"
            className="btn btn-danger-outline btn-block"
            onClick={() => {
              setMenuOpen(false);
              setDiscardOpen(true);
            }}
          >
            <IconTrash size={18} /> Discard workout
          </button>
        </Dialog>
      )}
      {finishOpen && <FinishDialog session={session} onClose={() => setFinishOpen(false)} onError={(m) => setSave({ status: 'error', message: m, retry: async () => true })} />}
      {discardOpen && (
        <ConfirmDialog
          title="Discard this workout?"
          confirmLabel="Discard workout"
          danger
          onCancel={() => setDiscardOpen(false)}
          onConfirm={async () => {
            await discardSession(session.id, clock.now());
            announce('Workout discarded. Nothing was saved to history.');
            navigate('/train');
          }}
        >
          <p>Completed sets won't be saved to history and no XP is awarded. This can't be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function SetEditor({ ex, setId, index, onChange, onDelete }: { ex: SessionExercise; setId: string; index: number; onChange: (patch: W.SetPatch) => Promise<boolean>; onDelete?: () => void }) {
  const set = ex.sets.find((s) => s.id === setId)!;
  const [errors, setErrors] = useState<{ load?: string; reps?: string; rir?: string }>({});
  const rirId = useId();
  const commit = (field: 'load' | 'reps' | 'durationSec', v: number | null) => {
    if (field === 'load') {
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > MAX_LOAD)) return setErrors({ ...errors, load: `Load must be 0–${MAX_LOAD}, or blank.` });
    } else {
      const max = field === 'reps' ? MAX_REPS : MAX_DURATION_SEC;
      if (v === null || !Number.isInteger(v) || v < 1 || v > max) return setErrors({ ...errors, reps: `Must be a whole number from 1 to ${max}.` });
    }
    setErrors({});
    void onChange({ [field]: v });
  };
  return (
    <div className="set-editor" aria-label={`Set ${index + 1} values`} role="group">
      {usesLoad(ex.loadType) && (
        <Stepper label={ex.loadType === 'assisted' ? 'Assistance' : ex.loadType === 'bodyweight-plus' ? 'Added load' : 'Weight'} unit={loadSuffix(ex.loadType, ex.unit)} value={set.load} step={loadStep(ex.loadType, ex.unit)} onCommit={(v) => commit('load', v)} error={errors.load} />
      )}
      {ex.loadType === 'timed' ? (
        <Stepper label="Time" unit="s" value={set.durationSec} step={5} min={1} decimals={0} onCommit={(v) => commit('durationSec', v)} error={errors.reps} />
      ) : (
        <Stepper label="Reps" unit="reps" value={set.reps} step={1} min={1} decimals={0} onCommit={(v) => commit('reps', v)} error={errors.reps} />
      )}
      <div className="row full" style={{ alignItems: 'flex-end' }}>
        <div className="field grow">
          <label className="field-label xs" htmlFor={rirId}>
            RIR (optional, reps in reserve)
          </label>
          <input
            id={rirId}
            className="input"
            inputMode="numeric"
            defaultValue={set.rir ?? ''}
            aria-invalid={errors.rir ? true : undefined}
            onBlur={(e) => {
              const t = e.target.value.trim();
              if (t === '') return void onChange({ rir: null });
              if (!/^\d+$/.test(t) || Number(t) > 10) return setErrors({ ...errors, rir: 'RIR must be 0–10.' });
              setErrors({});
              void onChange({ rir: Number(t) });
            }}
          />
          {errors.rir && <p className="error xs">{errors.rir}</p>}
        </div>
        {onDelete && (
          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Delete set ${index + 1}`} onClick={onDelete}>
            <IconTrash />
          </button>
        )}
      </div>
    </div>
  );
}

function SaveStatus({ save }: { save: SaveState }) {
  if (save.status === 'error') {
    return (
      <div className="status-banner amber" role="alert" data-testid="save-status" data-status="error">
        <IconCheck />
        <div className="row between wrap">
          <span className="small">{save.message}</span>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => void save.retry()}>
            Retry
          </button>
        </div>
      </div>
    );
  }
  return (
    <p className="xs muted" data-testid="save-status" data-status={save.status}>
      {save.status === 'saving' ? 'Saving…' : 'Draft saved on this device'}
    </p>
  );
}

function RestBanner({ session, onDismiss }: { session: WorkoutSession; onDismiss: () => void }) {
  const now = useNow(250);
  const remaining = W.restRemainingSec(session, now);
  const announce = useAnnounce();
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (remaining === 0 && session.restStartedAt && announced.current !== session.restStartedAt) {
      announced.current = session.restStartedAt;
      announce('Rest complete. Ready for your next set.');
    }
  }, [remaining, session.restStartedAt, announce]);
  if (remaining === null) return null;
  const doneResting = remaining === 0;
  return (
    <div className={`rest-banner ${doneResting ? 'is-done' : ''}`} data-testid="rest-timer">
      <div>
        <span className="eyebrow">{doneResting ? 'Rest complete' : 'Resting'}</span>
        <div className="rest-time" data-testid="rest-remaining" aria-label={doneResting ? 'Rest complete' : `${remaining} seconds of rest remaining`}>
          {clockTime(remaining)}
        </div>
      </div>
      <button type="button" className="btn btn-tertiary btn-sm" onClick={onDismiss}>
        {doneResting ? 'Dismiss' : 'Skip rest'}
      </button>
    </div>
  );
}

function FinishDialog({ session, onClose, onError }: { session: WorkoutSession; onClose: () => void; onError: (msg: string) => void }) {
  const { data } = useApp();
  const announce = useAnnounce();
  const now = clock.now();
  const plausible = W.timerIsPlausible(session, now);
  const [choice, setChoice] = useState<'timer' | 'manual' | 'not-recorded'>(plausible ? 'timer' : 'not-recorded');
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = W.completedSetCount(session);
  const minutesId = useId();

  if (valid === 0) {
    return (
      <Dialog
        title="Complete a set first"
        onClose={onClose}
        actions={
          <button type="button" className="btn btn-primary" onClick={onClose} data-autofocus>
            Back to workout
          </button>
        }
      >
        <p>Finishing needs at least one completed set. Tap the circle next to a set once you've done it. To stop without saving, use Discard in the options menu.</p>
      </Dialog>
    );
  }

  const incomplete = W.isIncomplete(session);
  const elapsedMin = Math.max(1, Math.round(W.activeElapsedSec(session, now) / 60));

  const confirm = async () => {
    if (busy) return;
    let duration: W.DurationChoice;
    if (choice === 'manual') {
      const m = parseMinutes(minutes);
      if (!m.ok) return setError(m.error);
      duration = { source: 'manual', minutes: m.value };
    } else duration = { source: choice };
    setBusy(true);
    try {
      await finishSession(session.id, clock.now(), duration, data.profile.timezone);
      announce('Workout complete. Nice work.');
      navigate(`/done/${encodeURIComponent(session.id)}`);
    } catch (err) {
      setBusy(false);
      onClose();
      onError(err instanceof Error ? err.message : 'Could not finish.');
    }
  };

  return (
    <Dialog
      title={incomplete ? 'Finish early?' : 'Finish workout?'}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-tertiary" onClick={onClose} data-autofocus>
            Keep going
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
            {incomplete ? 'Finish early' : 'Finish workout'}
          </button>
        </>
      }
    >
      <p className="num">
        You completed {plural(valid, 'set')} of {W.plannedSetCount(session)} planned across {plural(W.completedExerciseCount(session), 'exercise')}.
      </p>
      {incomplete && <p className="small muted">Only completed sets are saved. Unconfirmed prefilled values are discarded.</p>}
      <fieldset className="field">
        <legend className="field-label">Workout duration</legend>
        {!plausible && <p className="xs amber">The timer shows {elapsedMin} min for {valid} sets, which looks like data entry rather than training time.</p>}
        <label className="choice">
          <input type="radio" name="dur" checked={choice === 'timer'} onChange={() => setChoice('timer')} />
          <span className="choice-body">
            <span className="choice-label">Use timer: {elapsedMin} min</span>
            <span className="choice-hint">Start to finish, excluding pauses</span>
          </span>
        </label>
        <label className="choice">
          <input type="radio" name="dur" checked={choice === 'manual'} onChange={() => setChoice('manual')} />
          <span className="choice-body">
            <span className="choice-label">Enter duration</span>
          </span>
        </label>
        {choice === 'manual' && (
          <div className="field">
            <label htmlFor={minutesId} className="field-hint">
              Minutes
            </label>
            <input id={minutesId} className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
        )}
        <label className="choice">
          <input type="radio" name="dur" checked={choice === 'not-recorded'} onChange={() => setChoice('not-recorded')} />
          <span className="choice-body">
            <span className="choice-label">Don't record a duration</span>
          </span>
        </label>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
