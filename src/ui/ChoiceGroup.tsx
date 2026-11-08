import { useId } from 'react';

export interface Choice<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface SingleProps<T extends string | number> {
  legend: string;
  name: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  layout?: 'chips' | 'cards';
  description?: string;
}

/** Radio group rendered as large, touch-friendly chips. Native inputs keep keyboard and SR support. */
export function RadioGroup<T extends string | number>({ legend, name, choices, value, onChange, layout = 'chips', description }: SingleProps<T>) {
  const descId = useId();
  return (
    <fieldset className="field" aria-describedby={description ? descId : undefined}>
      <legend className="field-label">{legend}</legend>
      {description && (
        <p className="field-hint" id={descId}>
          {description}
        </p>
      )}
      <div className={`choices choices-${layout}`}>
        {choices.map((c) => (
          <label key={String(c.value)} className="choice">
            <input
              type="radio"
              name={name}
              value={String(c.value)}
              checked={value === c.value}
              disabled={c.disabled}
              onChange={() => onChange(c.value)}
            />
            <span className="choice-body">
              <span className="choice-label">{c.label}</span>
              {c.hint && <span className="choice-hint">{c.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface MultiProps<T extends string> {
  legend: string;
  name: string;
  choices: readonly Choice<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  description?: string;
}

export function CheckboxGroup<T extends string>({ legend, name, choices, values, onChange, description }: MultiProps<T>) {
  const descId = useId();
  return (
    <fieldset className="field" aria-describedby={description ? descId : undefined}>
      <legend className="field-label">{legend}</legend>
      {description && (
        <p className="field-hint" id={descId}>
          {description}
        </p>
      )}
      <div className="choices choices-chips">
        {choices.map((c) => (
          <label key={c.value} className="choice">
            <input
              type="checkbox"
              name={name}
              value={c.value}
              checked={values.includes(c.value)}
              disabled={c.disabled}
              onChange={(e) =>
                onChange(e.target.checked ? [...values, c.value] : values.filter((v) => v !== c.value))
              }
            />
            <span className="choice-body">
              <span className="choice-label">{c.label}</span>
              {c.hint && <span className="choice-hint">{c.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
