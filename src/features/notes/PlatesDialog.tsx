import { useId, useState } from 'react';
import { BARS, PLATES, plateBreakdown } from '../../domain/plates';
import type { ProgrammeExercise } from '../../domain/types';
import { Dialog } from '../../ui/Dialog';

const BAR_KEY = (unit: string) => `adaptfit:bar-${unit}`;

function savedBar(unit: 'kg' | 'lb'): number | null {
  try {
    const v = Number(localStorage.getItem(BAR_KEY(unit)));
    return BARS[unit].includes(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Which plates to load. Per-side loads are the plates on each side; a barbell
 * total needs the bar's weight, which the user picks once (never assumed).
 */
export function PlatesDialog({ ex, start, unit, onClose }: { ex: ProgrammeExercise; start: number | null; unit: 'kg' | 'lb'; onClose: () => void }) {
  const total = ex.loadType === 'total';
  const [value, setValue] = useState(start !== null ? String(start) : '');
  const [bar, setBar] = useState<number | null>(() => (total ? savedBar(unit) : null));
  const n = Number(value.replace(',', '.'));
  const load = value.trim() && Number.isFinite(n) && n > 0 ? { value: n, unit } : null;
  const result = load ? plateBreakdown({ load: load.value, loadType: ex.loadType, unit, bar }) : null;
  const weightId = useId();
  const pickBar = (b: number) => {
    setBar(b);
    try {
      localStorage.setItem(BAR_KEY(unit), String(b));
    } catch {
      /* not remembered */
    }
  };
  return (
    <Dialog
      title={`Plates · ${ex.name}`}
      onClose={onClose}
      actions={
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor={weightId}>
          {total ? `Total weight (${unit}), bar included` : `Weight on each side (${unit})`}
        </label>
        <input id={weightId} className="input input-num plates-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        <p className="field-hint">{start !== null ? 'From your note or your last record. Change it to plan another weight.' : 'Type the weight to load.'} Standard plates: {PLATES[unit].join(', ')} {unit}.</p>
      </div>
      {total && (
        <fieldset className="field">
          <legend className="field-label">Your bar</legend>
          <div className="seg" role="radiogroup" aria-label="Bar weight">
            {BARS[unit].map((b) => (
              <button key={b} type="button" role="radio" aria-checked={bar === b} className="seg-btn" onClick={() => pickBar(b)}>
                {b} {unit}
              </button>
            ))}
          </div>
          <p className="field-hint">Remembered on this device. Bar weight is never assumed.</p>
        </fieldset>
      )}
      <div className="plates-result" data-testid="plates-result" aria-live="polite">
        {!result || !load ? (
          <p className="muted">Enter a weight to see the plates.</p>
        ) : !result.ok ? (
          <p className="muted">{result.reason === 'needs-bar' ? 'Choose your bar to see the plates.' : `${load.value} ${unit} is lighter than the bar.`}</p>
        ) : (
          <>
            <span className="plates-label">Each side</span>
            <span className="plates-list">
              {result.plates.length === 0 ? (
                'No plates'
              ) : (
                result.plates.map((p, i) => (
                  <span key={i} className="plate" style={{ height: `${28 + Math.min(p, unit === 'kg' ? 25 : 45) * (unit === 'kg' ? 1.6 : 0.9)}px` }}>
                    {p}
                  </span>
                ))
              )}
            </span>
            {result.remainder > 0 && (
              <p className="small attention">
                Standard plates can’t make exactly {result.perSide} {unit} a side: this is {result.remainder} {unit} short each side.
              </p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
