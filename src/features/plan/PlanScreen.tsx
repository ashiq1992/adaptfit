import { useMemo, useState } from 'react';
import { addDays } from '../../domain/dates';
import { nextDay } from '../../domain/programme';
import { performanceText, prescription } from '../../domain/noteFormat';
import { weekStartOf } from '../../domain/progression';
import type { Programme, ProgrammeExercise, TrainingWeek } from '../../domain/types';
import { isCounted, latestReference, plannedSlots, suggestedDate, weekCounts, weekDates } from '../../domain/weekly';
import { useApp } from '../../ui/DataContext';
import { IconCheck, IconChevronRight, IconNotes, IconPlus, Wordmark } from '../../ui/icons';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { dayDate } from '../format';
import { createBlankNote } from '../notes/actions';

const PREVIEW_COUNT = 3;
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Plan: the main screen. Today's workout is the hero, one tap away. */
export function PlanScreen() {
  const { data, today } = useApp();
  const programme = data.activeProgramme;
  const weekStart = weekStartOf(today);
  const week = data.trainingWeeks.find((w) => w.weekStart === weekStart) ?? null;

  return (
    <div className="screen plan-screen">
      <ScreenHeader title={<Wordmark />} kicker={dayDate(today)} settings />
      {programme ? <Today programme={programme} /> : <StartNote />}
      {programme && <ThisWeek programme={programme} weekStart={weekStart} week={week} />}
      <NoteList programmes={data.programmes} />
      <nav className="plan-links" aria-label="More">
        <PlanLink href="#/library" label="Browse programmes" />
        <PlanLink href="#/import" label="Import from Notes" />
        <PlanLink href="#/weeks" label="Previous weeks" />
      </nav>
    </div>
  );
}

function PlanLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="plan-link">
      <span>{label}</span>
      <IconChevronRight size={18} />
    </a>
  );
}

/** Today's (or the next) planned session, shown like the top of a notebook page. */
function Today({ programme }: { programme: Programme }) {
  const { data, today } = useApp();
  const weekStart = weekStartOf(today);
  const unit = data.profile.weightUnit;
  const target = useMemo(() => {
    const slots = plannedSlots(programme, data.weekPlans, weekStart);
    const todays = slots.map((s, i) => ({ s, date: suggestedDate(programme, programme.days.find((d) => d.id === s.dayId)!.name, i, weekStart) })).find((x) => x.date === today);
    if (todays) return { day: programme.days.find((d) => d.id === todays.s.dayId)!, label: 'Today' };
    const next = nextDay(programme, data.sessions);
    return next ? { day: next, label: 'Next' } : null;
  }, [programme, data.weekPlans, data.sessions, weekStart, today]);
  if (!target) return null;
  const href = `#/note/${encodeURIComponent(programme.id)}/${encodeURIComponent(target.day.id)}`;
  const shown = target.day.exercises.slice(0, PREVIEW_COUNT);
  const more = target.day.exercises.length - shown.length;
  return (
    <section className="today" aria-labelledby="today-title">
      <div>
        <p className="today-label">{target.label}</p>
        <h2 id="today-title" className="today-title">
          <a href={href} className="card-link" data-testid="today-card">
            {target.day.name}
          </a>
        </h2>
        <p className="today-meta">
          {target.day.exercises.length} exercise{target.day.exercises.length === 1 ? '' : 's'} · {programme.name}
        </p>
      </div>
      {shown.length > 0 && (
        <ul className="today-list" aria-label={`${target.day.name} exercises`}>
          {shown.map((ex) => (
            <TodayLine key={ex.id} ex={ex} unit={unit} />
          ))}
          {more > 0 && (
            <li className="today-more">
              + {more} more
            </li>
          )}
        </ul>
      )}
      <a href={href} className="btn btn-primary btn-block btn-lg">
        Open workout
      </a>
    </section>
  );
}

/** Plan line: the printed prescription, and last time's record in blue ink. */
function TodayLine({ ex, unit }: { ex: ProgrammeExercise; unit: 'kg' | 'lb' }) {
  const { data } = useApp();
  const last = useMemo(() => latestReference(ex, data.sessions, data.imports, '9999-12-31'), [ex, data.sessions, data.imports]);
  const lastText = last ? performanceText(last.sets, ex.loadType, last.unit === 'lb' ? 'lb' : 'kg') : null;
  return (
    <li>
      <span className="note-ex-name">{ex.name}</span>
      <span className="note-ex-pres">{prescription(ex, unit) || '—'}</span>
      {lastText && (
        <span className="note-ex-last">
          <span className="when">Last</span>
          {lastText}
        </span>
      )}
    </li>
  );
}

/** This week as a strip of days: planned days outlined, recorded days ticked in blue ink. */
function ThisWeek({ programme, weekStart, week }: { programme: Programme; weekStart: string; week: TrainingWeek | null }) {
  const { data, today } = useApp();
  const slots = plannedSlots(programme, data.weekPlans, weekStart);
  const counts = week ? weekCounts(week) : null;
  const planned = counts?.planned ?? slots.length;
  const done = week ? week.sessions.filter(isCounted).length : 0;
  const confirmed = week?.status === 'confirmed';
  const lateInWeek = today >= addDays(weekStart, 4);

  const dates = weekDates(weekStart);
  const plannedDates = new Set(slots.map((s, i) => suggestedDate(programme, programme.days.find((d) => d.id === s.dayId)?.name ?? '', i, weekStart)).filter((d): d is string => !!d));
  const doneDates = new Set<string>();
  const skippedDates = new Set<string>();
  for (const s of week?.sessions ?? []) {
    if (!s.localDate) continue;
    if (isCounted(s)) doneDates.add(s.localDate);
    else if (s.status === 'skipped') skippedDates.add(s.localDate);
  }
  for (const s of data.completed) if (s.completedLocalDate && s.completedLocalDate >= weekStart && s.completedLocalDate <= dates[6]!) doneDates.add(s.completedLocalDate);

  let status: string;
  if (confirmed) status = `Confirmed · ${done} of ${planned} session${planned === 1 ? '' : 's'} recorded`;
  else if (week) status = `Draft saved · ${done} of ${planned} marked done`;
  else status = `${planned} planned session${planned === 1 ? '' : 's'} · nothing recorded yet`;

  return (
    <section className="page-section" aria-labelledby="week-title">
      <h2 id="week-title">
        This week
        <a href="#/week" data-testid="update-week">
          {confirmed ? 'Review this week' : week ? 'Continue weekly update' : 'Update this week'}
        </a>
      </h2>
      <ol className="week-strip" aria-label="Days this week">
        {dates.map((d, i) => {
          const state = doneDates.has(d) ? 'done' : skippedDates.has(d) ? 'skipped' : plannedDates.has(d) ? 'planned' : 'rest';
          const label = `${dayDate(d)}: ${state === 'done' ? 'trained' : state === 'skipped' ? 'skipped' : state === 'planned' ? 'planned' : 'no session planned'}`;
          return (
            <li key={d} className={d === today ? 'is-today' : undefined} aria-label={label}>
              <span aria-hidden="true">{WEEKDAY_INITIALS[i]}</span>
              <span className={`week-dot ${state}`} aria-hidden="true">
                {state === 'done' && <IconCheck />}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="week-status" data-testid="week-status">
        {status}
      </p>
      {!confirmed && lateInWeek && data.profile.notifications.weeklyReminder && <p className="small attention-text">Update any time before Sunday.</p>}
    </section>
  );
}

function NoteList({ programmes }: { programmes: Programme[] }) {
  if (!programmes.length) return null;
  return (
    <section aria-labelledby="notes-title" className="page-section">
      <h2 id="notes-title">Workout notes</h2>
      <ul className="note-list">
        {programmes.map((p) => (
          <li key={p.id}>
            <a href={`#/note/${encodeURIComponent(p.id)}`} className="note-card">
              <span className="note-card-icon" aria-hidden="true">
                <IconNotes />
              </span>
              <span className="note-card-body">
                <span className="note-card-title">
                  {p.name}
                  {p.isActive && <span className="pill pill-completed">Current</span>}
                </span>
                <span className="note-card-meta">{p.days.map((d) => d.name).join(' · ') || 'Empty note'}</span>
              </span>
              <IconChevronRight size={18} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** First run without a note: three ways to start, none of them a long form. */
function StartNote() {
  const { data } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <section className="today" aria-labelledby="start-title">
      <div>
        <p className="today-label">Start here</p>
        <h2 id="start-title" className="today-title">
          Start your <i>workout note</i>
        </h2>
        <p className="today-meta">Write your plan once. Update only what changes.</p>
      </div>
      <div className="stack-sm">
        <a href="#/import" className="btn btn-primary btn-block btn-lg">
          Paste from Notes
        </a>
        <a href="#/library" className="btn btn-secondary btn-block">
          Choose a programme
        </a>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void createBlankNote(data.profile, !!data.activeProgramme).finally(() => setBusy(false));
          }}
        >
          <IconPlus /> Write my own
        </button>
      </div>
    </section>
  );
}
