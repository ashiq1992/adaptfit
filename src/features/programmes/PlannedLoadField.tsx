import { useEffect, useId, useState } from 'react';
import { describePlannedLoad, usesPlannedLoad } from '../../domain/loads';
import { MAX_LOAD } from '../../domain/logging';
import type { LoadType, PlannedLoad, WeightUnit } from '../../domain/types';

const PLACEHOLDER: Partial<Record<LoadType, string>> = {
  'per-side': 'e.g. 30 (per side)',
  'per-dumbbell': 'e.g. 20 (each dumbbell)',
  total: 'e.g. 45 (total)',
  'bodyweight-plus': 'Added load, e.g. 10',
  assisted: 'Assistance, e.g. 20',
};

const LABEL: Partial<Record<LoadType, string>> = {
  'per-side': 'Planned starting weight (per side)',
  'per-dumbbell': 'Planned starting weight (per dumbbell)',
  total: 'Planned starting weight (total)',
  'bodyweight-plus': 'Planned added load',
  assisted: 'Planned assistance',
};

/**
 * Optional planned starting weight for a programme exercise. Stored with its
 * own unit; the logger prefills it only when there's no previous session.
 */
export function PlannedLoadField({ loadType, value, defaultUnit, onChange, exerciseName }: { loadType: LoadType; value: PlannedLoad | null; defaultUnit: WeightUnit; onChange: (v: PlannedLoad | null) => void; exerciseName: string }) {
  const id = useId();
  const unitId = useId();
  const hintId = useId();
  const [text, setText] = useState(value ? String(value.value) : '');
  const [error, setError] = useState<string | null>(null);
  const unit = value?.unit ?? defaultUnit;
  useEffect(() => setText(value ? String(value.value) : ''), [value]);

  if (!usesPlannedLoad(loadType)) {
    return <p className="xs muted">{loadType === 'timed' ? 'Timed exercise — no starting weight.' : loadType === 'bodyweight' ? 'Bodyweight — no starting weight needed.' : 'Choose how load is recorded to add a starting weight.'}</p>;
  }

  const commit = (raw: string, u: WeightUnit) => {
    const t = raw.trim().replace(',', '.');
    if (t === '') {
      setError(null);
      return onChange(null);
    }
    const n = Number(t);
    if (!/^\d+(\.\d+)?$/.test(t) || !Number.isFinite(n) || n > MAX_LOAD) {
      setError(`Enter a number between 0 and ${MAX_LOAD}.`);
      return;
    }
    setError(null);
    onChange({ value: Math.round(n * 100) / 100, unit: u });
  };

  return (
    <div className="planned-load">
      <div className="field">
        <label className="field-label xs" htmlFor={id}>
          {LABEL[loadType] ?? 'Planned starting weight'} <span className="faint">(optional)</span>
        </label>
        <div className="row" style={{ gap: 8 }}>
          <input
            id={id}
            className="input input-num"
            inputMode="decimal"
            value={text}
            placeholder={PLACEHOLDER[loadType]}
            aria-describedby={hintId}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value, unit)}
            data-testid={`planned-load-${exerciseName}`}
          />
          <label className="visually-hidden" htmlFor={unitId}>
            Unit for {exerciseName}
          </label>
          <select id={unitId} className="select select-unit" value={unit} onChange={(e) => commit(text, e.target.value as WeightUnit)}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
      </div>
      <p id={hintId} className="xs muted">
        {error ? (
          <span className="error">{error}</span>
        ) : value ? (
          `${describePlannedLoad(value.value, loadType, value.unit)}. Used only until you log this exercise; actual weights are recorded per set.`
        ) : loadType === 'per-side' ? (
          'Plates on one side only — bar weight is not assumed.'
        ) : (
          'Leave blank if unsure. Nothing is filled in for you.'
        )}
      </p>
    </div>
  );
}
