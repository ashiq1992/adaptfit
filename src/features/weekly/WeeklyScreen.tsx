import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { confirmWeek, discardWeekDraft, newId, saveWeekDraft, saveWeekEdit, setReviewDismissed, getWeekEdit } from '../../data/repo';
import { changedSets, isPerformanceChanged } from '../../domain/noteFormat';
import { weekStartOf } from '../../domain/progression';
import type { TrainingWeek, WeeklySessionRecord, WeeklySessionStatus } from '../../domain/types';
import {
  applyLoadUpdates,
  buildWeekDraft,
  confirmWeekRecord,
  editExercise,
  isCounted,
  markRemaining,
  noteLoadUpdates,
  previousConfirmedWeek,
  reconcileLive,
  SESSION_STATUS_LABEL,
  sessionsFromWeek,
  setSessionDate,
  setSessionStatus,
  toggleExerciseSkipped,
  weekCounts,
  weekDates,
  weekIssues,
} from '../../domain/weekly';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { useApp } from '../../ui/DataContext';
import { navigate } from '../../ui/hooks';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { trim } from '../../domain/loads';
import { dayDate, WEEKDAY_LABELS, weekLabel } from '../format';
import { useWeekReview, WeekReviewCard } from './WeekReview';
import { weekShareText } from '../../domain/shareText';
import { CopyDialog } from '../../ui/CopyDialog';

const STATUSES: WeeklySessionStatus[] = ['completed', 'partial', 'skipped', 'not-recorded'];

/**
 * Weekly update: see last week's confirmed values, change only what differs,
 * mark each session done / partly / skipped, confirm. Copied values never
 * count until a session is marked done and the week is confirmed.
 */
export function WeeklyScreen({ weekStart: param }: { weekStart: string | null }) {
  const { data, today } = useApp();
  const weekStart = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? weekStartOf(param) : weekStartOf(today);
  const stored = data.trainingWeeks.find((w) => w.weekStart === weekStart) ?? null;
  const [mode, setMode] = useState<'view' | 'edit'>(stored?.status === 'confirmed' ? 'view' : 'edit');
  const title = weekStart === weekStartOf(today) ? 'This week' : weekLabel(weekStart);

  return (
    <div className="screen weekly-screen">
      <ScreenHeader back={{ href: param ? '#/weeks' : '#/plan', label: param ? 'Previous weeks' : 'Plan' }} title={title} subtitle={weekStart === weekStartOf(today) ? weekLabel(weekStart) : undefined} />
      {stored?.status === 'confirmed' && mode === 'view' ? (
        <ConfirmedWeek week={stored} onEdit={() => setMode('edit')} />
      ) : stored || data.activeProgramme ? (
        <WeekEditor key={`${weekStart}:${stored?.revision ?? 0}`} weekStart={weekStart} stored={stored} onConfirmed={() => setMode('view')} />
      ) : (
        <section className="card">
          <p>Add a workout note first — the weekly update lists the sessions in your current plan.</p>
          <a href="#/plan" className="btn btn-primary">
            Go to Plan
          </a>
        </section>
      )}
    </div>
  );
}

function ConfirmedWeek({ week, onEdit }: { week: TrainingWeek; onEdit: () => void }) {
  const review = useWeekReview(week);
  const [sharing, setSharing] = useState(false);
  const shareText = () => weekShareText(week, { footer: `Logged with AdaptFit · ${location.origin}${location.pathname}` });
  return (
    <>
      {review && (
        <WeekReviewCard
          week={week}
          review={review}
          actions={
            <div className="row wrap">
              <a href="#/plan" className="btn btn-primary">
                Done
              </a>
              <button type="button" className="btn btn-secondary" onClick={() => setSharing(true)} data-testid="share-week">
                Share week
              </button>
              <button type="button" className="btn btn-tertiary" onClick={onEdit}>
                Edit this week
              </button>
              {week.reviewDismissed && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setReviewDismissed(week.weekStart, false)}>
                  Show on Coach again
                </button>
              )}
            </div>
          }
        />
      )}
      {sharing && <CopyDialog title="Share this week" label="Week as text" text={shareText()} onClose={() => setSharing(false)} />}
      <WeekSummaryList week={week} />
      {week.history.length > 0 && <p className="xs muted">Edited {week.history.length} time{week.history.length === 1 ? '' : 's'} after first confirming. Earlier versions are kept.</p>}
    </>
  );
}

function WeekSummaryList({ week }: { week: TrainingWeek }) {
  return (
    <section className="stack-sm" aria-label="Recorded sessions">
      {week.sessions.map((r) => (
        <div key={r.id} className="week-sheet-day">
          <h3 className="week-day-name">
            {r.name}
            {r.localDate && <span className="muted small"> · {dayDate(r.localDate)}</span>}
          </h3>
          {isCounted(r) ? (
            <ul className="note-lines">
              {r.exercises
                .filter((e) => e.status === 'done' && e.sets.length)
                .map((e, i) => (
                  <li key={`${e.exerciseId}-${i}`} className="sheet-line">
                    <span className="note-ex-name">{e.name}</span>
                    <span className="note-ex-pres">{e.text}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted small">{r.status === 'skipped' ? 'Skipped' : 'Not completed'}</p>
          )}
        </div>
      ))}
    </section>
  );
}

function WeekEditor({ weekStart, stored, onConfirmed }: { weekStart: string; stored: TrainingWeek | null; onConfirmed: () => void }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const programme = data.programmes.find((p) => p.id === stored?.programmeId) ?? data.activeProgramme;
  const editingConfirmed = stored?.status === 'confirmed';
  const previous = useMemo(() => previousConfirmedWeek(data.trainingWeeks, weekStart), [data.trainingWeeks, weekStart]);
  const [week, setWeek] = useState<TrainingWeek | null>(() => (stored ? reconcileLive(stored, data.sessions) : null));
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [reviewing, setReviewing] = useState(false);
  const [updateNote, setUpdateNote] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<TrainingWeek | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // Resume an unfinished edit of a confirmed week.
  useEffect(() => {
    if (!editingConfirmed) return;
    void getWeekEdit(weekStart).then((w) => {
      if (w) setWeek(w);
    });
  }, [editingConfirmed, weekStart]);

  const persist = useCallback(
    async (w: TrainingWeek) => {
      setSaved('saving');
      try {
        if (editingConfirmed) await saveWeekEdit(w);
        else await saveWeekDraft(w);
        setSaved('saved');
      } catch (err) {
        setSaved('error');
        setError(err instanceof Error ? err.message : 'Could not save the draft.');
      }
    },
    [editingConfirmed],
  );

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (pending.current) {
      const w = pending.current;
      pending.current = null;
      void persist(w);
    }
  }, [persist]);

  // Auto-save shortly after each change, and immediately if the app is hidden.
  const update = (fn: (w: TrainingWeek) => TrainingWeek) => {
    setWeek((w) => {
      if (!w) return w;
      const next = fn(w);
      pending.current = next;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 400);
      return next;
    });
    setReviewing(false);
  };
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const start = async (copy: boolean) => {
    const w = buildWeekDraft({ weekStart, programme, weekPlans: data.weekPlans, previousWeek: previous, sessions: data.sessions, imports: data.imports, now: clock.now(), unit: data.profile.weightUnit, copy });
    setWeek(w);
    await persist(w);
    announce(copy ? 'Copied. Change only what was different, then mark each session.' : 'Draft started from your plan.');
  };

  if (!week) {
    const hasHistory = !!previous || data.sessions.length > 0 || data.imports.some((i) => i.undated.length > 0);
    return (
      <section className="card start-week" aria-labelledby="start-week-title">
        <h2 id="start-week-title">Update {weekStart === weekStartOf(today) ? 'this week' : 'the week'}</h2>
        <p className="muted small">
          {hasHistory ? 'Start from your last recorded values and change only what was different.' : 'Start from your plan’s weights and reps, then change what was different.'} Nothing is recorded until you confirm.
        </p>
        {hasHistory && (
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => void start(true)} data-testid="copy-previous">
            Copy previous week
          </button>
        )}
        <button type="button" className={`btn ${hasHistory ? 'btn-tertiary' : 'btn-primary btn-lg'} btn-block`} onClick={() => void start(false)} data-testid="start-from-plan">
          Start from my plan
        </button>
      </section>
    );
  }

  const counts = weekCounts(week);
  const issues = weekIssues(week);
  const loadUpdates = noteLoadUpdates(week, programme);

  const confirm = async () => {
    if (issues.length) {
      setReviewing(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      window.clearTimeout(timer.current);
      pending.current = null;
      const now = clock.now();
      const { upserts, removeIds } = sessionsFromWeek(week, programme, newId, now);
      const confirmed = confirmWeekRecord(week, upserts, now);
      const programmeUpdate = updateNote && programme && loadUpdates.length ? applyLoadUpdates(programme, loadUpdates, now) : null;
      await confirmWeek(confirmed, upserts, removeIds, programmeUpdate, now);
      announce('Week confirmed. Your review is ready.');
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm the week.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="week-toolbar">
        <p className="small muted" data-testid="week-counts">
          {counts.completed + counts.partial} of {counts.planned} marked done{counts.changed ? ` · ${counts.changed} change${counts.changed === 1 ? '' : 's'}` : ''}
          <span className={`save-state ${saved}`} role="status" aria-live="polite">
            {saved === 'saving' ? ' · Saving…' : saved === 'saved' ? ' · Draft saved' : saved === 'error' ? ' · Not saved' : ''}
          </span>
        </p>
        {counts.notRecorded > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => update((w) => markRemaining(w, 'completed', clock.now()))} data-testid="mark-all-done">
            Mark all as done
          </button>
        )}
      </div>
      {editingConfirmed && <p className="small attention-text">You’re editing a confirmed week. Changes apply when you confirm again; the earlier version is kept.</p>}

      {week.sessions.map((r) => (
        <SessionBlock key={r.id} r={r} weekStart={weekStart} onChange={update} />
      ))}

      {reviewing && (
        <section className="card review-changes" aria-labelledby="changes-title" data-testid="review-changes">
          <h2 id="changes-title">Review changes</h2>
          <ul className="stack-sm small">
            {week.sessions.map((r) => (
              <li key={r.id}>
                <strong>{r.name}:</strong> {SESSION_STATUS_LABEL[r.status]}
                {r.localDate && isCounted(r) ? ` · ${dayDate(r.localDate)}` : ''}
                {isCounted(r) && (() => {
                  const changed = r.exercises.filter((e) => e.status === 'done' && isPerformanceChanged(e));
                  const blank = r.exercises.filter((e) => e.status === 'done' && !e.sets.length);
                  return (
                    <>
                      {changed.length > 0 && <> · changed: {changed.map((e) => e.name).join(', ')}</>}
                      {blank.length > 0 && <span className="muted"> · not recorded (no values): {blank.map((e) => e.name).join(', ')}</span>}
                    </>
                  );
                })()}
              </li>
            ))}
          </ul>
          {issues.length > 0 && (
            <div role="alert" className="stack-sm">
              {issues.map((i) => (
                <p key={`${i.sessionId}-${i.index}-${i.message}`} className="error">
                  {i.message}
                </p>
              ))}
            </div>
          )}
          {loadUpdates.length > 0 && (
            <label className="check-row">
              <input type="checkbox" checked={updateNote} onChange={(e) => setUpdateNote(e.target.checked)} />
              <span>
                Update my note to this week’s loads
                <span className="block xs muted">{loadUpdates.map((u) => `${u.name} ${u.from === null ? '' : `${trim(u.from)} → `}${trim(u.to)} ${u.unit}`).join(' · ')}</span>
              </span>
            </label>
          )}
        </section>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="week-actions">
        <button type="button" className="btn btn-tertiary" onClick={() => { flush(); announce('Draft saved.'); }}>
          Save draft
        </button>
        <button type="button" className="btn btn-tertiary" onClick={() => setReviewing((v) => !v)} aria-expanded={reviewing}>
          Review changes
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirm()} data-testid="confirm-week">
          {editingConfirmed ? 'Confirm changes' : 'Confirm week'}
        </button>
      </div>
      {!editingConfirmed && (
        <button
          type="button"
          className="link-btn small"
          onClick={() => {
            window.clearTimeout(timer.current);
            pending.current = null;
            void discardWeekDraft(weekStart).then(() => navigate('/plan'));
          }}
        >
          Discard draft
        </button>
      )}
    </div>
  );
}

function SessionBlock({ r, weekStart, onChange }: { r: WeeklySessionRecord; weekStart: string; onChange: (fn: (w: TrainingWeek) => TrainingWeek) => void }) {
  const dates = weekDates(weekStart);
  const counted = isCounted(r);
  const groupId = `st-${r.id}`;
  if (r.live) {
    return (
      <section className="week-sheet-day" aria-label={r.name}>
        <h3 className="week-day-name">
          {r.name} <span className="pill pill-completed">Logged in detail</span>
        </h3>
        <p className="xs muted">{r.localDate ? dayDate(r.localDate) : ''} · Values come from your set-by-set log and are counted once.</p>
        <ul className="note-lines">
          {r.exercises.map((e, i) => (
            <li key={i} className="sheet-line">
              <span className="note-ex-name">{e.name}</span>
              <span className="note-ex-pres">{e.text}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className={`week-sheet-day status-${r.status}`} aria-labelledby={`${groupId}-h`}>
      <h3 id={`${groupId}-h`} className="week-day-name">
        {r.name}
      </h3>
      <div className="seg" role="radiogroup" aria-label={`${r.name} status`}>
        {STATUSES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={r.status === s} className="seg-btn" onClick={() => onChange((w) => setSessionStatus(w, r.id, s, clock.now()))}>
            {SESSION_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {counted && (
        <div className="day-chips" role="radiogroup" aria-label={`Day you trained ${r.name}`}>
          {dates.map((d) => {
            const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
            const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
            return (
              <button key={d} type="button" role="radio" aria-checked={r.localDate === d} aria-label={dayDate(d)} className="day-chip" onClick={() => onChange((w) => setSessionDate(w, r.id, d, clock.now()))}>
                <span>{WEEKDAY_LABELS[dow]!.slice(0, 1)}</span>
                <span className="xs">{dd}</span>
              </button>
            );
          })}
        </div>
      )}
      {counted && !r.localDate && <p className="xs attention-text">Choose the day you trained.</p>}
      <ul className="sheet-lines">
        {r.exercises.map((e, i) => {
          const changed = isPerformanceChanged(e);
          const changedIdx = changedSets(e.sets, e.previous?.sets ?? null);
          const inputId = `w-${r.id}-${i}`;
          const unreadable = !!e.text.trim() && e.sets.length === 0;
          return (
            <li key={`${e.programmeExerciseId ?? e.exerciseId}-${i}`} className={`sheet-row ${changed ? 'changed' : ''} ${e.status === 'skipped' ? 'skipped' : ''}`}>
              <label htmlFor={inputId} className="sheet-name">
                {e.name}
                {e.source === 'planned' && <span className="tag">from plan</span>}
                {changed && <span className="tag tag-changed">changed{changedIdx.length && e.sets.length > 1 ? ` · set ${changedIdx.map((x) => x + 1).join(', ')}` : ''}</span>}
              </label>
              <div className="row">
                <input
                  id={inputId}
                  className="input sheet-input"
                  value={e.text}
                  inputMode="text"
                  autoComplete="off"
                  enterKeyHint="next"
                  placeholder={e.loadType === 'timed' ? 'e.g. 3 × 45 s' : e.loadType === 'bodyweight' ? 'e.g. BW × 10, 10, 9' : 'e.g. 30 × 8, 8, 8'}
                  aria-invalid={unreadable || undefined}
                  aria-describedby={changed || unreadable ? `${inputId}-d` : undefined}
                  disabled={e.status === 'skipped'}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    onChange((w) => editExercise(w, r.id, i, v, clock.now()));
                  }}
                />
                {r.status === 'partial' && (
                  <button type="button" className="btn btn-ghost btn-sm" aria-pressed={e.status === 'skipped'} onClick={() => onChange((w) => toggleExerciseSkipped(w, r.id, i, clock.now()))}>
                    {e.status === 'skipped' ? 'Skipped' : 'Skip'}
                  </button>
                )}
              </div>
              {unreadable && (
                <p id={`${inputId}-d`} className="xs error">
                  Couldn’t read this. Try “30 × 8, 8, 8”.
                </p>
              )}
              {!unreadable && changed && e.previous && (
                <p id={`${inputId}-d`} className="xs muted">
                  was {e.previous.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {counted && r.exercises.some((e) => e.status === 'done' && !e.sets.length) && <p className="xs muted">Rows left empty aren’t recorded — AdaptFit never assumes they were unchanged.</p>}
      {r.status === 'not-recorded' && <p className="xs muted">Not counted until you mark it.</p>}
    </section>
  );
}
