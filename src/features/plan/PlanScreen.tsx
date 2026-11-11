import { useState } from 'react';
import { deleteSession } from '../../data/repo';
import { addDays } from '../../domain/dates';
import { estimateDayMinutes } from '../../domain/programme';
import { weekStartOf } from '../../domain/progression';
import type { Programme, ProgrammeDay, TrainingWeek } from '../../domain/types';
import { dedupeSessions } from '../../domain/weekly';
import { useAnnounce } from '../../ui/Announcer';
import { useApp } from '../../ui/DataContext';
import { IconCheck, IconChevronRight, IconNotes, IconPlus, Wordmark } from '../../ui/icons';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { dayDate } from '../format';
import { createBlankNote } from '../notes/actions';
import { LogWorkoutDialog } from './LogWorkout';
import { useTodayTarget } from './todayTarget';
import { WeekSummary } from './WeekSummary';

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Plan, the home screen: your workouts, ready to log. Every day of the current
 * note is one tap from logging; the suggested one ("Next up") is highlighted
 * but never forced, so doing a different workout today costs nothing extra.
 */
export function PlanScreen() {
  const { data, today } = useApp();
  const programme = data.activeProgramme;
  const weekStart = weekStartOf(today);
  const week = data.trainingWeeks.find((w) => w.weekStart === weekStart) ?? null;
  const others = data.programmes.filter((p) => p.id !== programme?.id);

  return (
    <div className="screen plan-screen">
      <ScreenHeader title={<Wordmark />} kicker={dayDate(today)} settings />
      <WeekSummary thisWeekStart={weekStart} />
      {programme ? (
        <>
          <ThisWeek programme={programme} weekStart={weekStart} week={week} />
          <Workouts programme={programme} />
        </>
      ) : (
        <StartNote />
      )}
      {others.length > 0 && <NoteList programmes={others} />}
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

/** The current note's days as cards: open one to see or edit it, or log it straight away. */
function Workouts({ programme }: { programme: Programme }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const target = useTodayTarget(programme);
  const [logging, setLogging] = useState<ProgrammeDay | null>(null);
  const [logged, setLogged] = useState<{ id: string; name: string; date: string } | null>(null);
  const noteHref = `#/note/${encodeURIComponent(programme.id)}`;
  const doneToday = new Set(data.completed.filter((s) => s.programmeId === programme.id && s.completedLocalDate === today).map((s) => s.dayId));

  return (
    <section className="page-section" aria-labelledby="workouts-title">
      <h2 id="workouts-title">
        Your workouts
        <a href={noteHref} aria-label={`Edit ${programme.name}`}>
          Edit
        </a>
      </h2>
      <p className="small muted workouts-note">{programme.name}</p>
      {programme.days.length === 0 ? (
        <p className="muted">
          No workouts in this note yet. <a href={noteHref}>Add one</a>
        </p>
      ) : (
        <ol className="workout-list">
          {programme.days.map((d) => {
            const isTarget = target?.day.id === d.id;
            const n = d.exercises.length;
            const names = d.exercises.slice(0, 3).map((x) => x.name);
            const done = doneToday.has(d.id);
            return (
              <li key={d.id} className={`workout-card${isTarget ? ' is-next' : ''}`}>
                <a href={`${noteHref}/${encodeURIComponent(d.id)}`} className="workout-card-link" data-testid={isTarget ? 'today-card' : 'workout-card'}>
                  <span className="workout-card-top">
                    <span className="workout-card-name">{d.name}</span>
                    {done ? (
                      <span className="pill pill-completed">
                        <IconCheck size={14} /> Done today
                      </span>
                    ) : (
                      isTarget && <span className="pill pill-next">{target.label}</span>
                    )}
                  </span>
                  <span className="day-row-meta">{n === 0 ? 'No exercises yet' : `${n} exercise${n === 1 ? '' : 's'} · about ${estimateDayMinutes(d)} min`}</span>
                  {names.length > 0 && (
                    <span className="day-row-ex">
                      {names.join(', ')}
                      {n > names.length ? `, +${n - names.length} more` : ''}
                    </span>
                  )}
                </a>
                {n > 0 && (
                  <button type="button" className={`btn ${isTarget && !done ? 'btn-primary' : 'btn-secondary'} btn-sm workout-card-log`} aria-label={`Log ${d.name}`} onClick={() => setLogging(d)}>
                    Log
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {logging && (
        <LogWorkoutDialog
          programme={programme}
          day={logging}
          onClose={() => setLogging(null)}
          onLogged={(id, date) => {
            setLogged({ id, name: logging.name, date });
            setLogging(null);
            announce(`${logging.name} logged for ${date === today ? 'today' : dayDate(date)}.`);
          }}
        />
      )}
      {logged && (
        <div className="toast" role="status" data-testid="logged-toast">
          <span>
            {logged.name} logged{logged.date === today ? ' for today' : ` for ${dayDate(logged.date)}`}.
          </span>
          <button
            type="button"
            className="btn btn-tertiary btn-sm"
            onClick={() => {
              const l = logged;
              setLogged(null);
              void deleteSession(l.id).then(() => announce('Log removed.'));
            }}
          >
            Undo
          </button>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setLogged(null)}>
            OK
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * This week as a count towards the weekly target ("2 of 3"), not a row of
 * weekdays: a missed Wednesday isn't a failure, only the week's total counts.
 * Also the way into the weekly update, to fill in workouts not logged here.
 */
function ThisWeek({ programme, weekStart, week }: { programme: Programme; weekStart: string; week: TrainingWeek | null }) {
  const { data, today } = useApp();
  const weekEnd = addDays(weekStart, 6);
  // A weekly update and a log of the same workout count once.
  const counted = dedupeSessions(data.completed)
    .filter((s) => s.completedLocalDate && s.completedLocalDate >= weekStart && s.completedLocalDate <= weekEnd)
    .sort((a, b) => (a.completedLocalDate! < b.completedLocalDate! ? -1 : 1));
  const target = Math.max(1, programme.daysPerWeek || programme.days.length);
  const n = counted.length;
  const confirmed = week?.status === 'confirmed';
  const lateInWeek = today >= addDays(weekStart, 4);
  const status = n === 0 ? `0 of ${target} workouts · nothing logged yet` : n >= target ? `${n} of ${target} workouts · week’s target reached` : `${n} of ${target} workouts · ${target - n} to go`;
  return (
    <section className="page-section week-progress" aria-labelledby="week-title">
      <h2 id="week-title">
        This week
        <a href="#/week" data-testid="update-week">
          {confirmed ? 'Review this week' : week ? 'Continue weekly update' : 'Fill in the week'}
        </a>
      </h2>
      <div className="week-pips" role="img" aria-label={`${n} of ${target} workouts done this week`}>
        {Array.from({ length: Math.max(target, n) }, (_, i) => (
          <span key={i} className={`week-pip${i < n ? ' done' : ''}`} />
        ))}
      </div>
      <p className="week-status" data-testid="week-status">
        {status}
      </p>
      {counted.length > 0 && (
        <p className="small muted" data-testid="week-done">
          {counted.map((s) => `${SHORT_DAY[new Date(`${s.completedLocalDate}T12:00:00`).getDay()]} ${s.name}`).join(' · ')}
        </p>
      )}
      {!confirmed && lateInWeek && n < target && data.profile.notifications.weeklyReminder && <p className="small muted">Trained without logging? Fill in the week any time before Sunday.</p>}
    </section>
  );
}

function NoteList({ programmes }: { programmes: Programme[] }) {
  return (
    <section aria-labelledby="notes-title" className="page-section">
      <h2 id="notes-title">Other workout notes</h2>
      <ul className="note-list">
        {programmes.map((p) => (
          <li key={p.id}>
            <a href={`#/note/${encodeURIComponent(p.id)}`} className="note-card">
              <span className="note-card-icon" aria-hidden="true">
                <IconNotes />
              </span>
              <span className="note-card-body">
                <span className="note-card-title">{p.name}</span>
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
