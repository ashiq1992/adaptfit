import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXERCISES_BY_ID } from '../../content/exercises';
import { countNoteRevisions, deleteNote, newId, saveNote, undoNote } from '../../data/repo';
import { LOAD_TYPE_LABEL } from '../../domain/loads';
import { dayText, exerciseText, type ConvertContext, noteLoad, parseDayText, parseExerciseBlock, performanceText, prescription, programmeText, UNCERTAIN_LABEL } from '../../domain/noteFormat';
import { createProgramme, duplicateDay, estimateDayMinutes } from '../../domain/programme';
import type { CustomExercise, LoadType, Programme, ProgrammeDay, ProgrammeExercise } from '../../domain/types';
import { latestReference } from '../../domain/weekly';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { useApp } from '../../ui/DataContext';
import { ConfirmDialog, Dialog } from '../../ui/Dialog';
import { navigate, useLive } from '../../ui/hooks';
import { IconBack, IconChevronRight, IconClock, IconDown, IconMore, IconPlus, IconTrash, IconUp } from '../../ui/icons';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { dayDate, hashParams, weekLabel } from '../format';
import { startDay } from '../train/start';
import { BlockEditor, listDrafts, readDraft } from './BlockEditor';
import { CopyDialog } from '../../ui/CopyDialog';
import { applySameAnswer, familyWord, sameAnswerOffer, type SameAnswerOffer } from '../../domain/clarify';
import { recentBest } from '../../domain/bests';
import { plateCalculable } from '../../domain/plates';
import { restLabel, startRest, startHold } from '../../ui/restTimer';
import { PlatesDialog } from './PlatesDialog';
import { useTodayTarget } from '../plan/todayTarget';
import { LogWorkoutDialog } from '../plan/LogWorkout';

type Editing =
  | { kind: 'exercise'; dayId: string; exId: string | 'new' }
  | { kind: 'day-text'; dayId: string }
  | { kind: 'day-name'; dayId: string }
  | { kind: 'title' }
  | { kind: 'preamble' }
  | null;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CONVENTIONS: LoadType[] = ['total', 'per-side', 'per-dumbbell', 'bodyweight-plus', 'assisted'];

function draftKeyOf(programmeId: string, e: NonNullable<Editing>): string {
  switch (e.kind) {
    case 'exercise':
      return `${programmeId}:ex:${e.dayId}:${e.exId}`;
    case 'day-text':
      return `${programmeId}:day:${e.dayId}`;
    case 'day-name':
      return `${programmeId}:dayname:${e.dayId}`;
    case 'title':
      return `${programmeId}:title`;
    case 'preamble':
      return `${programmeId}:preamble`;
  }
}

function editingFromKey(programmeId: string, key: string): Editing {
  const rest = key.slice(programmeId.length + 1).split(':');
  switch (rest[0]) {
    case 'ex':
      return { kind: 'exercise', dayId: rest[1]!, exId: rest[2]! };
    case 'day':
      return { kind: 'day-text', dayId: rest[1]! };
    case 'dayname':
      return { kind: 'day-name', dayId: rest[1]! };
    case 'title':
      return { kind: 'title' };
    case 'preamble':
      return { kind: 'preamble' };
    default:
      return null;
  }
}

/**
 * The workout note: the most important screen. It reads like a note and every
 * line can be tapped and edited in place. Changes save automatically, every
 * save keeps an undoable revision, and unsaved typing survives a refresh.
 */
export function NoteScreen({ id, dayId }: { id: string; dayId: string | null }) {
  const { data } = useApp();
  const programme = data.programmes.find((p) => p.id === id) ?? null;
  if (!programme) {
    return (
      <div className="screen">
        <ScreenHeader title="Note not found" back={{ href: '#/plan', label: 'Plan' }} />
        <p className="muted">This note may have been deleted. Deleted notes can be recovered from a backup.</p>
      </div>
    );
  }
  // A fresh page per day: open editors and save state never carry over to another day.
  return <NoteBody key={`${programme.id}:${dayId ?? ''}`} programme={programme} focusDayId={dayId} />;
}

function NoteBody({ programme, focusDayId }: { programme: Programme; focusDayId: string | null }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const unit = data.profile.weightUnit;
  // One day at a time: with a day in the address only that day is shown (and
  // can be edited); without one, the note shows its list of days.
  const focusDay = focusDayId ? (programme.days.find((d) => d.id === focusDayId) ?? null) : null;
  const pendingDayId = useMemo(() => {
    const pending = listDrafts(`${programme.id}:`)[0];
    const e = pending ? editingFromKey(programme.id, pending.key) : null;
    return e && 'dayId' in e && programme.days.some((d) => d.id === e.dayId) ? e.dayId : null;
  }, [programme.id, programme.days]);
  // Unsaved text for another day (refresh, crash): open that day to restore it.
  useEffect(() => {
    if (pendingDayId && pendingDayId !== focusDay?.id) navigate(`/note/${encodeURIComponent(programme.id)}/${encodeURIComponent(pendingDayId)}`);
  }, [pendingDayId, focusDay?.id, programme.id]);
  const [editing, setEditing] = useState<Editing>(() => {
    // Reopen an editor whose text wasn't saved (refresh, crash, closed app), if it belongs on this page.
    const pending = listDrafts(`${programme.id}:`)[0];
    const e = pending ? editingFromKey(programme.id, pending.key) : null;
    if (e && ('dayId' in e ? e.dayId === focusDay?.id : !focusDay)) return e;
    const p = hashParams();
    if (p.get('edit') === 'text' && focusDay) return { kind: 'day-text', dayId: focusDay.id };
    return null;
  });
  // "?edit=text" for a day that was only just created (its data can arrive a moment after this page opens).
  const askedText = useRef(false);
  useEffect(() => {
    if (askedText.current || !focusDay || hashParams().get('edit') !== 'text') return;
    askedText.current = true;
    setEditing((cur) => cur ?? { kind: 'day-text', dayId: focusDay.id });
  }, [focusDay]);
  const [restored] = useState(() => listDrafts(`${programme.id}:`).length > 0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [removed, setRemoved] = useState<string | null>(null);
  const [offer, setOffer] = useState<SameAnswerOffer | null>(null);
  const [menu, setMenu] = useState<'note' | { dayId: string } | null>(null);
  const [confirm, setConfirm] = useState<'delete-note' | { dayId: string } | null>(null);
  const [copyText, setCopyText] = useState<string | null>(null);
  const [restAll, setRestAll] = useState(false);
  const [logging, setLogging] = useState<ProgrammeDay | null>(null);
  const revisions = useLive(() => countNoteRevisions(programme.id), [programme.id, programme.updatedAt]);

  const ctx = useCallback((): ConvertContext & { created: CustomExercise[] } => ({ newId, unit, custom: data.customExercises, created: [], now: clock.now() }), [unit, data.customExercises]);

  const save = useCallback(
    async (next: Programme, reason: string, created: CustomExercise[] = []) => {
      setSaveState('saving');
      try {
        await saveNote(next, reason, clock.now(), { created });
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        announce(err instanceof Error ? err.message : 'Could not save.');
        throw err;
      }
    },
    [announce],
  );

  const replaceDay = (p: Programme, day: ProgrammeDay): Programme => ({ ...p, days: p.days.map((d) => (d.id === day.id ? day : d)) });

  const commit = async (e: NonNullable<Editing>, text: string, closing: boolean) => {
    if (closing) setEditing(null);
    const c = ctx();
    let next: Programme | null = null;
    let reason = 'Edited';
    if (e.kind === 'title') {
      const name = text.trim().slice(0, 200);
      if (name && name !== programme.name) next = { ...programme, name };
      reason = 'Renamed';
    } else if (e.kind === 'preamble') {
      if (text !== programme.notes) next = { ...programme, notes: text.slice(0, 5000) };
    } else if (e.kind === 'day-name') {
      const day = programme.days.find((d) => d.id === e.dayId);
      const name = text.trim().slice(0, 200);
      if (day && name && name !== day.name) next = replaceDay(programme, { ...day, name });
      reason = 'Renamed day';
    } else if (e.kind === 'day-text') {
      const day = programme.days.find((d) => d.id === e.dayId);
      if (day && text.trim() !== dayText(day, unit).trim()) next = replaceDay(programme, parseDayText(text, day, c));
      reason = 'Edited as text';
    } else if (e.kind === 'exercise') {
      const day = programme.days.find((d) => d.id === e.dayId);
      if (!day) return;
      if (e.exId === 'new') {
        const ex = text.trim() ? parseExerciseBlock(text, c) : null;
        if (ex) next = replaceDay(programme, { ...day, exercises: [...day.exercises, ex] });
        reason = 'Added exercise';
      } else {
        const prev = day.exercises.find((x) => x.id === e.exId);
        if (!prev) return;
        if (!text.trim()) {
          next = replaceDay(programme, { ...day, exercises: day.exercises.filter((x) => x.id !== prev.id) });
          reason = `Removed ${prev.name}`;
          setRemoved(prev.name);
        } else if (text.trim() !== exerciseText(prev, unit).trim()) {
          const ex = parseExerciseBlock(text, c, prev);
          if (ex) next = replaceDay(programme, { ...day, exercises: day.exercises.map((x) => (x.id === prev.id ? ex : x)) });
        }
      }
    }
    if (next) await save(next, reason, c.created);
  };

  const patchExercise = (day: ProgrammeDay, ex: ProgrammeExercise, patch: Partial<ProgrammeExercise>, reason: string) =>
    save(replaceDay(programme, { ...day, exercises: day.exercises.map((x) => (x.id === ex.id ? { ...x, ...patch } : x)) }), reason);

  const moveExercise = async (day: ProgrammeDay, exId: string, dir: -1 | 1) => {
    const i = day.exercises.findIndex((x) => x.id === exId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= day.exercises.length) return;
    const list = [...day.exercises];
    [list[i], list[j]] = [list[j]!, list[i]!];
    await save(replaceDay(programme, { ...day, exercises: list }), 'Reordered');
  };

  const removeExercise = async (day: ProgrammeDay, ex: ProgrammeExercise) => {
    setEditing(null);
    await save(replaceDay(programme, { ...day, exercises: day.exercises.filter((x) => x.id !== ex.id) }), `Removed ${ex.name}`);
    setRemoved(ex.name);
  };

  const undo = async () => {
    const restoredNote = await undoNote(programme.id);
    setRemoved(null);
    announce(restoredNote ? 'Undone.' : 'Nothing to undo.');
  };

  const editor = (e: NonNullable<Editing>, initial: string, label: string, opts: { toolbar?: ReactNode; single?: boolean; hint?: ReactNode; minRows?: number } = {}) => {
    const key = draftKeyOf(programme.id, e);
    return <BlockEditor key={key} initial={initial} draftKey={key} label={label} restored={restored && readDraft(key) !== null} onCommit={(t, closing) => commit(e, t, closing)} onCancel={() => setEditing(null)} {...opts} />;
  };

  const isEditing = (e: NonNullable<Editing>) => editing !== null && JSON.stringify(editing) === JSON.stringify(e);

  const live = data.profile.loggingMode === 'live';

  const noteHref = `#/note/${encodeURIComponent(programme.id)}`;
  const dayHref = (d: ProgrammeDay) => `${noteHref}/${encodeURIComponent(d.id)}`;
  const focusIndex = focusDay ? programme.days.findIndex((d) => d.id === focusDay.id) : -1;
  // Back always goes up one level, named for where it goes: a day of the current
  // note lives on the home screen's list; other notes' days on their own list.
  const backTo = focusDay ? (programme.isActive ? { href: '#/plan', label: 'Workouts' } : { href: noteHref, label: programme.name }) : { href: '#/plan', label: 'Workouts' };
  const days = focusDay ? [focusDay] : [];

  return (
    <div className="screen note-screen">
      <ScreenHeader
        back={backTo}
        title={
          focusDay ? (
            isEditing({ kind: 'day-name', dayId: focusDay.id }) ? (
              <span className="visually-hidden">{focusDay.name}</span>
            ) : (
              <button type="button" className="note-title" onClick={() => setEditing({ kind: 'day-name', dayId: focusDay.id })} aria-label={`Day name: ${focusDay.name}. Tap to rename.`}>
                {focusDay.name}
              </button>
            )
          ) : isEditing({ kind: 'title' }) ? (
            <span className="visually-hidden">{programme.name}</span>
          ) : (
            <button type="button" className="note-title" onClick={() => setEditing({ kind: 'title' })} aria-label={`Note title: ${programme.name}. Tap to rename.`}>
              {programme.name}
            </button>
          )
        }
        subtitle={focusDay ? `${programme.name} · day ${focusIndex + 1} of ${programme.days.length}` : undefined}
        actions={
          <>
            <SaveIndicator state={saveState} />
            {(revisions.data ?? 0) > 0 && (
              <button type="button" className="btn btn-tertiary btn-sm" onClick={() => void undo()} data-testid="undo">
                Undo
              </button>
            )}
            {focusDay ? (
              <button type="button" className="btn btn-ghost btn-icon" aria-label={`Options for ${focusDay.name}`} aria-haspopup="dialog" onClick={() => setMenu({ dayId: focusDay.id })}>
                <IconMore />
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Note options" aria-haspopup="dialog" onClick={() => setMenu('note')}>
                <IconMore />
              </button>
            )}
          </>
        }
      />
      {!focusDay && isEditing({ kind: 'title' }) && editor({ kind: 'title' }, programme.name, 'Note title', { single: true })}
      {focusDay && isEditing({ kind: 'day-name', dayId: focusDay.id }) && editor({ kind: 'day-name', dayId: focusDay.id }, focusDay.name, 'Day name', { single: true })}
      {!focusDay && !programme.isActive && (
        <p className="small muted">
          Not your current plan.{' '}
          <button type="button" className="link-btn" onClick={() => void saveNote(programme, 'Made current', clock.now(), { activate: true }).then(() => announce('This is now your current plan.'))}>
            Make current
          </button>
        </p>
      )}

      {!focusDay &&
        (isEditing({ kind: 'preamble' }) ? (
          editor({ kind: 'preamble' }, programme.notes, 'Note text at the top', { minRows: 2 })
        ) : programme.notes ? (
          <button type="button" className="note-free" onClick={() => setEditing({ kind: 'preamble' })}>
            {programme.notes}
          </button>
        ) : null)}

      {!focusDay && <DayList programme={programme} dayHref={dayHref} />}

      {days.map((day) => (
        <section key={day.id} id={`day-${day.id}`} className="note-day" aria-label={`${day.name} exercises`}>
          <div className="row wrap">
            <button type="button" className="btn btn-primary" onClick={() => setLogging(day)}>
              Log this workout
            </button>
            {live && (
              <button type="button" className="btn btn-tertiary btn-sm" onClick={() => void startLive(day)}>
                Log live
              </button>
            )}
          </div>

          {isEditing({ kind: 'day-text', dayId: day.id }) ? (
            editor({ kind: 'day-text', dayId: day.id }, dayText(day, unit), `Edit ${day.name} as text`, {
              minRows: 8,
              hint: 'Write it like a note: an exercise name, then a line such as “3 sets × 8 reps — 30 kg/side”. Lines AdaptFit doesn’t understand are kept as notes.',
            })
          ) : (
            <>
              {day.exercises.length === 0 && !isEditing({ kind: 'exercise', dayId: day.id, exId: 'new' }) && (
                <p className="muted small">
                  No exercises yet.{' '}
                  <button type="button" className="link-btn" onClick={() => setEditing({ kind: 'day-text', dayId: day.id })}>
                    Type or paste them
                  </button>
                </p>
              )}
              <ul className="note-lines">
                {day.exercises.map((ex, idx) =>
                  isEditing({ kind: 'exercise', dayId: day.id, exId: ex.id }) ? (
                    <li key={ex.id} className="note-line editing">
                      {editor({ kind: 'exercise', dayId: day.id, exId: ex.id }, exerciseText(ex, unit), `Edit ${ex.name}`, {
                        minRows: 2,
                        toolbar: (
                          <>
                            <ToolButton label="Move up" disabled={idx === 0} onClick={() => void moveExercise(day, ex.id, -1)}>
                              <IconUp />
                            </ToolButton>
                            <ToolButton label="Move down" disabled={idx === day.exercises.length - 1} onClick={() => void moveExercise(day, ex.id, 1)}>
                              <IconDown />
                            </ToolButton>
                            <ToolButton label={`Remove ${ex.name}`} onClick={() => void removeExercise(day, ex)}>
                              <IconTrash />
                            </ToolButton>
                          </>
                        ),
                      })}
                    </li>
                  ) : (
                    <ExerciseLine key={ex.id} ex={ex} unit={unit} onEdit={() => setEditing({ kind: 'exercise', dayId: day.id, exId: ex.id })} onPatch={(patch, reason) => void patchExercise(day, ex, patch, reason)} onLoadType={(t) => setOffer(sameAnswerOffer(programme, ex, t))} />
                  ),
                )}
                {isEditing({ kind: 'exercise', dayId: day.id, exId: 'new' }) && (
                  <li className="note-line editing">{editor({ kind: 'exercise', dayId: day.id, exId: 'new' }, '', `New exercise in ${day.name}`, { minRows: 2, hint: 'e.g. “Lat pulldown” then “3 sets × 10 reps — 45 kg”, or one line: “Lat pulldown 45 kg 3x10”.' })}</li>
                )}
              </ul>
              {day.notes && (
                <button type="button" className="note-free" onClick={() => setEditing({ kind: 'day-text', dayId: day.id })}>
                  {day.notes}
                </button>
              )}
              {!isEditing({ kind: 'exercise', dayId: day.id, exId: 'new' }) && (
                <button type="button" className="note-add" onClick={() => setEditing({ kind: 'exercise', dayId: day.id, exId: 'new' })}>
                  <IconPlus /> Add exercise
                </button>
              )}
            </>
          )}
        </section>
      ))}

      {focusDay && (
        <a href={backTo.href} className="btn btn-secondary btn-block day-back">
          <IconBack size={18} /> Back to {backTo.label.toLowerCase() === 'workouts' ? 'your workouts' : backTo.label}
        </a>
      )}

      {!focusDay && (
        <button
          type="button"
          className="note-add"
          onClick={() => {
            const day: ProgrammeDay = { id: newId(), name: `Day ${programme.days.length + 1}`, exercises: [], notes: '' };
            void save({ ...programme, days: [...programme.days, day] }, 'Added day').then(() => navigate(`/note/${encodeURIComponent(programme.id)}/${encodeURIComponent(day.id)}?edit=text`));
          }}
        >
          <IconPlus /> Add day
        </button>
      )}

      {offer && (
        <div className="toast toast-offer" role="status" data-testid="same-answer">
          <span>
            Also use “{offer.loadType === 'total' ? 'Total' : LOAD_TYPE_LABEL[offer.loadType].replace(' (assistance amount)', '')}” for {offer.targets.length === 1 ? 'the other' : `the ${offer.targets.length} other`} {familyWord(offer.family)} {offer.targets.length === 1 ? 'exercise' : 'exercises'} still asking?
          </span>
          <span className="toast-actions">
            <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setOffer(null)}>
              No
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                const o = offer;
                setOffer(null);
                void save(applySameAnswer(programme, o), 'Clarified loading').then(() => announce(`Updated ${o.targets.length} more.`));
              }}
            >
              {offer.targets.length === 1 ? 'Apply' : `Apply to ${offer.targets.length}`}
            </button>
          </span>
        </div>
      )}
      {removed && (
        <div className="toast" role="status">
          <span>Removed {removed}.</span>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => void undo()}>
            Undo
          </button>
        </div>
      )}

      {menu === 'note' && <NoteMenu programme={programme} onClose={() => setMenu(null)} onEditTop={() => setEditing({ kind: 'preamble' })} onCopy={() => setCopyText(programmeText(programme, unit))} onRestAll={() => setRestAll(true)} onDelete={() => setConfirm('delete-note')} save={save} />}
      {restAll && (
        <RestAllDialog
          programme={programme}
          onClose={() => setRestAll(false)}
          onPick={(sec) => {
            setRestAll(false);
            void save({ ...programme, days: programme.days.map((d) => ({ ...d, exercises: d.exercises.map((x) => ({ ...x, restSec: sec })) })) }, 'Changed rest').then(() => announce(sec ? `Rest set to ${restLabel(sec)} for every exercise.` : 'Rest timer turned off for every exercise.'));
          }}
        />
      )}
      {menu && menu !== 'note' && (
        <DayMenu
          programme={programme}
          day={programme.days.find((d) => d.id === menu.dayId)!}
          onClose={() => setMenu(null)}
          onEditText={() => setEditing({ kind: 'day-text', dayId: menu.dayId })}
          onLive={(d) => void startLive(d)}
          onDelete={() => setConfirm({ dayId: menu.dayId })}
          onCopy={(d) => setCopyText(dayText(d, unit))}
          save={save}
        />
      )}
      {confirm === 'delete-note' && (
        <ConfirmDialog
          title={`Delete “${programme.name}”?`}
          confirmLabel="Delete note"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            void deleteNote(programme.id, clock.now()).then(() => {
              announce('Note deleted. Your workout history is kept.');
              navigate('/plan');
            });
          }}
        >
          <p>The note is removed from your plans. Recorded workouts and weekly history stay as they are, and a copy of the note is kept in your next backup.</p>
        </ConfirmDialog>
      )}
      {confirm && confirm !== 'delete-note' && (
        <ConfirmDialog
          title={`Delete ${programme.days.find((d) => d.id === confirm.dayId)?.name ?? 'this day'}?`}
          confirmLabel="Delete day"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const day = programme.days.find((d) => d.id === confirm.dayId);
            setConfirm(null);
            if (day)
              void save({ ...programme, days: programme.days.filter((d) => d.id !== day.id) }, `Deleted ${day.name}`).then(() => {
                announce(`${day.name} deleted. Undo is on the note.`);
                navigate(`/note/${encodeURIComponent(programme.id)}`);
              });
          }}
        >
          <p>Its exercises are removed from this note. Past workouts stay in your history, and you can undo this.</p>
        </ConfirmDialog>
      )}
      {copyText !== null && <CopyDialog text={copyText} onClose={() => setCopyText(null)} />}
      {logging && (
        <LogWorkoutDialog
          programme={programme}
          day={logging}
          onClose={() => setLogging(null)}
          onLogged={(_id, date) => {
            const name = logging.name;
            setLogging(null);
            announce(`${name} logged for ${date === today ? 'today' : dayDate(date)}.`);
          }}
        />
      )}
    </div>
  );

  async function startLive(day: ProgrammeDay) {
    setMenu(null);
    if (data.active) {
      navigate('/workout');
      return;
    }
    await startDay({ programme, day, planKind: 'programme-day', history: data.sessions, profile: data.profile, checkIn: null });
    navigate('/workout');
  }
}

/** The note's days: tap one to see (and edit) only that day. */
function DayList({ programme, dayHref }: { programme: Programme; dayHref: (d: ProgrammeDay) => string }) {
  const target = useTodayTarget(programme);
  if (!programme.days.length) return null;
  return (
    <>
      <p className="small muted">Tap a day to see and edit its exercises.</p>
      <ol className="day-list" aria-label="Days">
        {programme.days.map((d) => {
          const n = d.exercises.length;
          const toCheck = d.exercises.filter((x) => x.uncertain.some((f) => f !== 'sets' && f !== 'reps')).length;
          const names = d.exercises.slice(0, 3).map((x) => x.name);
          const tag = target?.day.id === d.id ? target.label : null;
          return (
            <li key={d.id}>
              <a href={dayHref(d)} className="day-row" data-testid="day-row">
                <span className="day-row-main">
                  <span className="day-row-name">{d.name}</span>
                  <span className="day-row-meta">
                    {n === 0 ? 'No exercises yet' : `${n} exercise${n === 1 ? '' : 's'} · about ${estimateDayMinutes(d)} min`}
                  </span>
                  {names.length > 0 && (
                    <span className="day-row-ex">
                      {names.join(', ')}
                      {n > names.length ? `, +${n - names.length} more` : ''}
                    </span>
                  )}
                </span>
                <span className="day-row-tags">
                  {tag && <span className="pill pill-completed">{tag}</span>}
                  {toCheck > 0 && <span className="pill pill-attention">{toCheck} to check</span>}
                </span>
                <IconChevronRight size={18} />
              </a>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon" aria-label={label} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const text = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Not saved' : '';
  return (
    <span className={`save-state ${state}`} role="status" aria-live="polite" data-testid="save-state">
      {text}
    </span>
  );
}

/** One exercise as note text, with anything uncertain shown in amber and resolvable in one tap. */
function ExerciseLine({ ex, unit, onEdit, onPatch, onLoadType }: { ex: ProgrammeExercise; unit: 'kg' | 'lb'; onEdit: () => void; onPatch: (p: Partial<ProgrammeExercise>, reason: string) => void; onLoadType?: (t: LoadType) => void }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const [plates, setPlates] = useState(false);
  const best = useMemo(() => recentBest(ex, data.sessions, today), [ex, data.sessions, today]);
  const canPlates = plateCalculable(ex);
  const rest = ex.restSec > 0 ? restLabel(ex.restSec) : null;
  const hold = ex.loadType === 'timed' && ex.durationSec ? restLabel(ex.durationSec) : null;
  const pres = prescription(ex, unit);
  const last = useMemo(() => latestReference(ex, data.sessions, data.imports, '9999-12-31'), [ex, data.sessions, data.imports]);
  const lastText = last ? performanceText(last.sets, ex.loadType, last.unit === 'lb' ? 'lb' : 'kg') : null;
  const lib = EXERCISES_BY_ID.get(ex.exerciseId);
  return (
    <li className="note-line">
      <button type="button" className="note-ex" onClick={onEdit}>
        <span className="visually-hidden">Edit </span>
        <span className="note-ex-head">
          <span className="note-ex-name">{ex.name}</span>
          {best && (
            <span className="pill pill-pr note-best" data-testid="new-best">
              New best
            </span>
          )}
        </span>
        <span className="note-ex-pres">{pres || <span className="faint">Tap to add sets and reps</span>}</span>
        {ex.notes && <span className="note-ex-notes">{ex.notes}</span>}
        {lastText && (
          <span className="note-ex-last">
            <span className="when">{last!.weekStart ? `Last · w/c ${weekLabel(last!.weekStart).replace('Week of ', '').replace(/(\d+ \w{3})\w*/, '$1')}` : 'Last · undated'}</span>
            {lastText}
          </span>
        )}
      </button>
      {(rest || canPlates || hold) && (
        <div className="note-ex-tools">
          {hold && (
            <button
              type="button"
              className="btn btn-tertiary btn-sm"
              aria-label={`Time ${hold}: start a ${hold} timer for ${ex.name}`}
              onClick={() => {
                startHold(ex.name, ex.durationSec!);
                announce(`Timer started: ${hold}.`);
              }}
            >
              <IconClock size={16} /> Time {hold}
            </button>
          )}
          {rest && (
            <button
              type="button"
              className="btn btn-tertiary btn-sm"
              aria-label={`Rest ${rest}: start the timer for ${ex.name}`}
              onClick={() => {
                startRest(ex.name, ex.restSec);
                announce(`Rest timer started: ${rest}.`);
              }}
            >
              <IconClock size={16} /> Rest {rest}
            </button>
          )}
          {canPlates && (
            <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setPlates(true)} aria-label={`Plates for ${ex.name}`}>
              Plates
            </button>
          )}
        </div>
      )}
      {plates && (
        <PlatesDialog
          ex={ex}
          unit={ex.plannedLoad?.unit ?? (last?.unit === 'lb' ? 'lb' : last ? 'kg' : unit)}
          start={ex.plannedLoad?.value ?? (last ? Math.max(0, ...last.sets.map((s) => s.load ?? 0)) || null : null)}
          onClose={() => setPlates(false)}
        />
      )}
      {ex.uncertain.filter((f) => f !== 'sets' && f !== 'reps').map((f) => (
        <div key={f} className="clarify" role="group" aria-label={UNCERTAIN_LABEL[f]}>
          <span className="clarify-q">{UNCERTAIN_LABEL[f]}</span>
          <div className="clarify-options">
            {f === 'loadType' &&
              CONVENTIONS.map((t) => (
                <button key={t} type="button" className="btn btn-tertiary btn-sm" onClick={() => {
                    onPatch({ loadType: t, uncertain: ex.uncertain.filter((u) => u !== 'loadType') }, 'Clarified loading');
                    onLoadType?.(t);
                  }}
                >
                  {t === 'total' ? 'Total' : LOAD_TYPE_LABEL[t].replace(' (assistance amount)', '')}
                  {ex.plannedLoad && t !== 'bodyweight-plus' && t !== 'assisted' ? ` · ${noteLoad(ex.plannedLoad.value, t, ex.plannedLoad.unit)}` : ''}
                </button>
              ))}
            {f === 'unit' &&
              (['kg', 'lb'] as const).map((u) => (
                <button key={u} type="button" className="btn btn-tertiary btn-sm" onClick={() => onPatch({ plannedLoad: ex.plannedLoad ? { ...ex.plannedLoad, unit: u } : null, uncertain: ex.uncertain.filter((x) => x !== 'unit') }, 'Clarified unit')}>
                  {u}
                </button>
              ))}
            {f === 'exercise' && (
              <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onPatch({ uncertain: ex.uncertain.filter((x) => x !== 'exercise') }, 'Kept exercise name')}>
                Keep “{ex.name}”
              </button>
            )}
          </div>
          {f === 'loadType' && lib && <p className="field-hint">Loads are only compared with records using the same convention. Bar weight is never assumed.</p>}
        </div>
      ))}
    </li>
  );
}

const REST_CHOICES = [60, 90, 120, 180, 0];

/** One rest time for every exercise in the note (each can still be changed in its text). */
function RestAllDialog({ programme, onClose, onPick }: { programme: Programme; onClose: () => void; onPick: (sec: number) => void }) {
  const all = programme.days.flatMap((d) => d.exercises.map((x) => x.restSec));
  const same = all.length && all.every((r) => r === all[0]) ? all[0]! : null;
  return (
    <Dialog title="Rest between sets" onClose={onClose} actions={<button type="button" className="btn btn-tertiary btn-block" onClick={onClose}>Cancel</button>}>
      <p className="small muted">Sets the rest timer for every exercise in this note. To change one exercise, tap it and edit its “Rest 1:30” line.</p>
      <div className="menu" role="group" aria-label="Rest for every exercise">
        {REST_CHOICES.map((sec) => (
          <button key={sec} type="button" className="menu-item" aria-pressed={same === sec} onClick={() => onPick(sec)}>
            {sec ? restLabel(sec) : 'No rest timer'}
            {sec === 90 ? ' (default)' : ''}
            {same === sec ? ' · current' : ''}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function NoteMenu({ programme, onClose, onEditTop, onCopy, onRestAll, onDelete, save }: { programme: Programme; onClose: () => void; onEditTop: () => void; onCopy: () => void; onRestAll: () => void; onDelete: () => void; save: (p: Programme, reason: string) => Promise<void> }) {
  const { data } = useApp();
  const announce = useAnnounce();
  const item = (label: string, fn: () => void, danger = false) => (
    <button
      type="button"
      className={`menu-item ${danger ? 'danger' : ''}`}
      onClick={() => {
        onClose();
        fn();
      }}
    >
      {label}
    </button>
  );
  return (
    <Dialog title={programme.name} onClose={onClose} actions={<button type="button" className="btn btn-tertiary btn-block" onClick={onClose}>Close</button>}>
      <div className="menu">
        {item('Copy as text', onCopy)}
        {item('Duplicate this plan', () => {
          const now = clock.now();
          const copy = createProgramme(newId, now, { name: `${programme.name} (copy)`, goal: programme.goal, days: programme.days.map((d) => ({ ...duplicateDay(d, newId), name: d.name })), daysPerWeek: programme.daysPerWeek, preferredWeekdays: programme.preferredWeekdays, source: 'created' });
          void saveNote({ ...copy, notes: programme.notes, isActive: false }, 'Duplicated', now).then(() => {
            announce('Duplicated.');
            navigate(`/note/${encodeURIComponent(copy.id)}`);
          });
        })}
        {item(programme.notes ? 'Edit text at the top' : 'Add text at the top', onEditTop)}
        {!programme.isActive && item('Make this my current plan', () => void saveNote(programme, 'Made current', clock.now(), { activate: true }).then(() => announce('This is now your current plan.')))}
        {item(`Sessions per week: ${programme.daysPerWeek}`, () => {
          const n = programme.daysPerWeek >= 7 ? 1 : programme.daysPerWeek + 1;
          void save({ ...programme, daysPerWeek: n }, 'Changed frequency').then(() => announce(`${n} sessions per week.`));
        })}
        {item('Rest between sets…', onRestAll)}
        {item('Rest times and priorities…', () => navigate(`/programmes/${encodeURIComponent(programme.id)}`))}
        {data.programmes.length > 0 && item('Delete note…', onDelete, true)}
      </div>
    </Dialog>
  );
}

function DayMenu({ programme, day, onClose, onEditText, onLive, onDelete, onCopy, save }: { programme: Programme; day: ProgrammeDay; onClose: () => void; onEditText: () => void; onLive: (d: ProgrammeDay) => void; onDelete: () => void; onCopy: (d: ProgrammeDay) => void; save: (p: Programme, reason: string) => Promise<void> }) {
  const idx = programme.days.findIndex((d) => d.id === day.id);
  const move = (dir: -1 | 1) => {
    const days = [...programme.days];
    [days[idx], days[idx + dir]] = [days[idx + dir]!, days[idx]!];
    void save({ ...programme, days }, 'Reordered days');
  };
  const item = (label: string, fn: () => void, opts: { danger?: boolean; disabled?: boolean } = {}) => (
    <button
      type="button"
      className={`menu-item ${opts.danger ? 'danger' : ''}`}
      disabled={opts.disabled}
      onClick={() => {
        onClose();
        fn();
      }}
    >
      {label}
    </button>
  );
  return (
    <Dialog title={day.name} onClose={onClose} actions={<button type="button" className="btn btn-tertiary btn-block" onClick={onClose}>Close</button>}>
      <div className="menu">
        {item('Edit as text', onEditText)}
        {item('Copy as text', () => onCopy(day))}
        {item('Duplicate day', () => {
          const copy = duplicateDay(day, newId);
          const days = [...programme.days];
          days.splice(idx + 1, 0, copy);
          void save({ ...programme, days }, 'Duplicated day').then(() => navigate(`/note/${encodeURIComponent(programme.id)}/${encodeURIComponent(copy.id)}`));
        })}
        {item('Move day up', () => move(-1), { disabled: idx === 0 })}
        {item('Move day down', () => move(1), { disabled: idx === programme.days.length - 1 })}
        {item('Log sets live (optional)', () => onLive(day), { disabled: day.exercises.length === 0 })}
        {item('Delete day…', onDelete, { danger: true, disabled: programme.days.length <= 1 })}
      </div>
    </Dialog>
  );
}
