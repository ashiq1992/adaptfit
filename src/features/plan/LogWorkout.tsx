import { useMemo, useState } from 'react';
import { newId, saveLoggedSession } from '../../data/repo';
import { addDays } from '../../domain/dates';
import { editLogRow, loggableCount, loggedOn, loggedSession, logRows, toggleLogRowSkipped } from '../../domain/quickLog';
import type { ExercisePerformance, Programme, ProgrammeDay } from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { Segmented } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { Dialog } from '../../ui/Dialog';
import { navigate } from '../../ui/hooks';
import { dayDate } from '../format';
import { startDay } from '../train/start';

type When = 'today' | 'yesterday' | 'other';

/**
 * Log a whole workout in one go: pick the day, check the values (last time's,
 * else the plan's), save. One screen, one tap when nothing changed.
 */
export function LogWorkoutDialog({ programme, day, onClose, onLogged }: { programme: Programme; day: ProgrammeDay; onClose: () => void; onLogged: (id: string, date: string) => void }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const [when, setWhen] = useState<When>('today');
  const [other, setOther] = useState(addDays(today, -2));
  const date = when === 'today' ? today : when === 'yesterday' ? addDays(today, -1) : other;
  const [rows, setRows] = useState<ExercisePerformance[]>(() => logRows(day, data.sessions, data.imports, today, data.profile.weightUnit));
  const [busy, setBusy] = useState(false);
  const already = useMemo(() => loggedOn(data.sessions, programme.id, date), [data.sessions, programme.id, date]);
  const count = loggableCount(rows);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;

  const save = async () => {
    const id = newId();
    const s = loggedSession({ programme, day, rows, localDate: date, id, newId, now: clock.now() });
    if (!s) return;
    setBusy(true);
    try {
      await saveLoggedSession(s);
      onLogged(id, date);
    } catch (err) {
      announce(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Log ${day.name}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" data-testid="log-save" disabled={busy || count === 0 || !validDate} onClick={() => void save()}>
            Save workout
          </button>
        </>
      }
    >
      <Segmented<When>
        label="When"
        value={when}
        onChange={setWhen}
        options={[
          { id: 'today', label: 'Today' },
          { id: 'yesterday', label: 'Yesterday' },
          { id: 'other', label: 'Other day' },
        ]}
      />
      {when === 'other' && (
        <label className="field">
          <span className="field-label">Date</span>
          <input type="date" className="input" value={other} max={today} onChange={(e) => setOther(e.target.value)} />
        </label>
      )}
      {already.length > 0 && (
        <p className="small attention-text" role="status">
          Already logged on {dayDate(date)}: {already.map((s) => s.name).join(', ')}. Saving adds another workout.
        </p>
      )}
      <p className="small muted">Filled in from last time (or your plan). Change anything that was different, or tap Skipped.</p>
      <ul className="log-rows">
        {rows.map((r, i) => {
          const skipped = r.status === 'skipped';
          return (
            <li key={`${r.programmeExerciseId ?? r.exerciseId}-${i}`} className={`log-row${skipped ? ' is-skipped' : ''}`}>
              <label className="log-row-name" htmlFor={`log-${i}`}>
                {r.name}
              </label>
              <div className="log-row-inputs">
                <input
                  id={`log-${i}`}
                  className="input"
                  value={r.text}
                  disabled={skipped}
                  placeholder={r.loadType === 'timed' ? 'e.g. 30 s, 30 s, 30 s' : r.loadType === 'bodyweight' ? 'e.g. 10, 10, 8' : `e.g. 30 ${r.unit} × 8, 8, 8`}
                  autoComplete="off"
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? editLogRow(x, e.target.value) : x)))}
                />
                <button type="button" className="btn btn-tertiary btn-sm" aria-pressed={skipped} aria-label={`Skipped ${r.name}`} onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? toggleLogRowSkipped(x) : x)))}>
                  Skipped
                </button>
              </div>
              {!skipped && r.text.trim() !== '' && r.sets.length === 0 && <span className="xs attention-text">Not understood: write it like “30 kg × 8, 8, 8”.</span>}
            </li>
          );
        })}
      </ul>
      {!data.active && (
        <button
          type="button"
          className="link-btn align-start"
          onClick={() => {
            onClose();
            void startDay({ programme, day, planKind: 'programme-day', history: data.sessions, profile: data.profile, checkIn: null }).then(() => navigate('/workout'));
          }}
        >
          Log set by set while training instead
        </button>
      )}
    </Dialog>
  );
}
