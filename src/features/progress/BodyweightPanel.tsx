import { useId, useState } from 'react';
import { deleteBodyweight, deleteMeasurement, newId, saveBodyweight, saveMeasurement } from '../../data/repo';
import { bodyweightTrend, displayValue, entriesInRange, parseBodyweight, weeklyAverages } from '../../domain/bodyweight';
import { isLocalDate } from '../../domain/dates';
import type { Range } from '../../domain/progression';
import type { BodyweightEntry, WeightUnit } from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { LineChart } from '../../ui/Charts';
import { clock } from '../../ui/clock';
import { useApp } from '../../ui/DataContext';
import { ConfirmDialog } from '../../ui/Dialog';
import { IconEdit, IconTrash } from '../../ui/icons';
import { shortDate } from '../format';

/**
 * Personal bodyweight log (V0.3). Optional, no daily weigh-ins required, and
 * separate from the loads you lift. AdaptFit never infers body fat, muscle
 * gain, or fat loss from bodyweight alone.
 */
export function BodyweightPanel({ range }: { range: Range }) {
  const { data, today } = useApp();
  const unit = data.profile.weightUnit;
  const [editing, setEditing] = useState<BodyweightEntry | null>(null);
  const [confirm, setConfirm] = useState<BodyweightEntry | null>(null);
  const announce = useAnnounce();
  const inRange = entriesInRange(data.bodyweights, range, today);
  const weeks = weeklyAverages(inRange, unit);
  const trend = bodyweightTrend(inRange, unit);

  return (
    <>
      <EntryForm key={editing?.id ?? 'new'} editing={editing} onDone={() => setEditing(null)} />
      <section className="card" aria-labelledby="bw-chart-title" data-testid="bodyweight-chart">
        <h2 id="bw-chart-title" className="card-title">
          Bodyweight
        </h2>
        {inRange.length >= 2 ? (
          <LineChart title="Bodyweight" unit={unit} points={inRange.map((e) => ({ label: shortDate(e.localDate), value: displayValue(e, unit), tip: `${displayValue(e, unit)}` }))} />
        ) : (
          <p className="small muted">{data.bodyweights.length === 0 ? 'No entries yet. Weighing in once a week is plenty — daily weigh-ins are not needed.' : 'Record bodyweight on two or more days in this range to see a chart.'}</p>
        )}
        <div className="stack-sm" data-testid="bodyweight-trend">
          <span className="section-label">Trend (optional)</span>
          <p className="small">{trend.text}</p>
          {trend.needed && <p className="xs muted">{trend.needed}</p>}
          <p className="xs faint">Bodyweight alone can't show body-fat or muscle changes; it moves with water, food, and timing.</p>
        </div>
      </section>
      {weeks.length > 0 && (
        <section className="card" aria-labelledby="bw-weeks-title">
          <h2 id="bw-weeks-title" className="card-title">
            Weekly averages
          </h2>
          <ul className="change-rows" data-testid="weekly-averages">
            {[...weeks].reverse().map((w) => (
              <li key={w.weekStart}>
                <span className="small">Week of {shortDate(w.weekStart)}</span>
                <span className="small num">
                  {w.average} {unit} <span className="muted">({w.entries} {w.entries === 1 ? 'entry' : 'entries'})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card" aria-labelledby="bw-list-title">
        <h2 id="bw-list-title" className="card-title">
          Entries
        </h2>
        {data.bodyweights.length === 0 ? (
          <p className="small muted">Nothing recorded yet.</p>
        ) : (
          <ul className="change-rows" data-testid="bodyweight-list">
            {[...data.bodyweights].reverse().map((e) => (
              <li key={e.id}>
                <span className="small num">{shortDate(e.localDate)}</span>
                <span className="small num grow" style={{ textAlign: 'right' }}>
                  {e.value} {e.unit}
                  {e.unit !== unit ? <span className="muted"> ({displayValue(e, unit)} {unit})</span> : null}
                  {e.note ? <span className="xs muted" style={{ display: 'block' }}>{e.note}</span> : null}
                </span>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit entry from ${e.localDate}`} onClick={() => setEditing(e)}>
                  <IconEdit size={18} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Delete entry from ${e.localDate}`} onClick={() => setConfirm(e)}>
                  <IconTrash size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <WaistMeasurements />
      {confirm && (
        <ConfirmDialog
          title="Delete this entry?"
          confirmLabel="Delete entry"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteBodyweight(confirm.id);
            setConfirm(null);
            announce('Bodyweight entry deleted.');
          }}
        >
          <p>
            {confirm.value} {confirm.unit} on {confirm.localDate}.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}

function EntryForm({ editing, onDone }: { editing: BodyweightEntry | null; onDone: () => void }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const [date, setDate] = useState(editing?.localDate ?? today);
  const [value, setValue] = useState(editing ? String(editing.value) : '');
  const [unit, setUnit] = useState<WeightUnit>(editing?.unit ?? data.profile.weightUnit);
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const ids = { d: useId(), v: useId(), u: useId(), n: useId() };

  const save = async () => {
    const parsed = parseBodyweight({ localDate: date, value, unit, note }, today);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const iso = clock.now().toISOString();
    await saveBodyweight(editing ? { ...editing, localDate: date, value: parsed.value, unit, note: note.trim(), updatedAt: iso } : { id: newId(), localDate: date, value: parsed.value, unit, note: note.trim(), createdAt: iso, updatedAt: iso });
    announce(editing ? 'Bodyweight entry updated.' : 'Bodyweight saved.');
    setValue('');
    setNote('');
    onDone();
  };

  return (
    <section className="card" aria-labelledby="bw-form-title" data-testid="bodyweight-form">
      <h2 id="bw-form-title" className="card-title">
        {editing ? 'Edit bodyweight entry' : 'Add bodyweight'}
      </h2>
      <p className="xs muted">Optional. Separate from the weights you lift. Stored only on this device.</p>
      <div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor={ids.d}>
            Date
          </label>
          <input id={ids.d} type="date" className="input" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={ids.v}>
            Bodyweight
          </label>
          <div className="row" style={{ gap: 8 }}>
            <input id={ids.v} className="input input-num" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            <label className="visually-hidden" htmlFor={ids.u}>
              Unit
            </label>
            <select id={ids.u} className="select select-unit" value={unit} onChange={(e) => setUnit(e.target.value as WeightUnit)}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label className="field-label" htmlFor={ids.n}>
            Note (optional)
          </label>
          <input id={ids.n} className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. morning, after travel" />
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row wrap">
        <button type="button" className="btn btn-primary btn-grow" onClick={save}>
          {editing ? 'Save changes' : 'Save entry'}
        </button>
        {editing && (
          <button type="button" className="btn btn-tertiary" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

/** Waist measurements kept from V0.2 (optional). */
function WaistMeasurements() {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const [date, setDate] = useState(today);
  const [waist, setWaist] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ids = { d: useId(), w: useId() };
  const items = data.measurements.filter((m) => m.waistCm !== null);
  const add = async () => {
    const x = Number(waist.replace(',', '.'));
    if (!isLocalDate(date) || date > today) return setError('Enter a valid date (not in the future).');
    if (!waist.trim() || !Number.isFinite(x) || x < 30 || x > 300) return setError('Waist must be 30–300 cm.');
    setError(null);
    await saveMeasurement({ id: newId(), localDate: date, bodyweightKg: null, waistCm: x, note: '', createdAt: clock.now().toISOString() });
    setWaist('');
    announce('Waist measurement saved.');
  };
  return (
    <details className="card disclosure">
      <summary className="strong">Waist measurements (optional)</summary>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="field">
          <label className="field-label" htmlFor={ids.d}>
            Date
          </label>
          <input id={ids.d} type="date" className="input" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={ids.w}>
            Waist (cm)
          </label>
          <input id={ids.w} className="input input-num" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} />
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-secondary" onClick={add}>
        Save waist
      </button>
      <ul className="change-rows">
        {[...items].reverse().map((m) => (
          <li key={m.id}>
            <span className="small num">{shortDate(m.localDate)}</span>
            <span className="small muted num">{m.waistCm} cm</span>
            <button type="button" className="btn btn-ghost btn-icon" aria-label={`Delete waist measurement from ${m.localDate}`} onClick={() => void deleteMeasurement(m.id)}>
              <IconTrash size={18} />
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
