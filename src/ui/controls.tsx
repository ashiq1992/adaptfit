import { type ReactNode, useId, useState } from 'react';
import type { ChangeKind } from '../domain/progression';
import { IconChevronDown, IconDash, IconDown, IconMinus, IconPlus, IconUp } from './icons';

/** Tablist with arrow-key navigation. Panels are rendered by the caller. */
export function Tabs<T extends string>({ tabs, value, onChange, label, idBase }: { tabs: readonly { id: T; label: string }[]; value: T; onChange: (t: T) => void; label: string; idBase: string }) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!;
    onChange(next.id);
    document.getElementById(`${idBase}-tab-${next.id}`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          id={`${idBase}-tab-${t.id}`}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === t.id}
          aria-controls={`${idBase}-panel`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Toggle-button group (e.g. 4W / 8W / 12W / All). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly { id: T; label: string }[]; value: T; onChange: (t: T) => void; label: string }) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="tab" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * −/+ stepper with free text entry. The text is validated by the caller on
 * commit; arbitrary values (e.g. 31.25) are allowed.
 */
export function Stepper({ label, value, step, min = 0, onCommit, unit, decimals = 2, error }: { label: string; value: number | null; step: number; min?: number; onCommit: (v: number | null, raw: string) => void; unit: string; decimals?: number; error?: string | null }) {
  const id = useId();
  const errId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(value));
  const bump = (dir: 1 | -1) => {
    const base = value ?? 0;
    const next = Math.max(min, Math.round((base + dir * step) * 10 ** decimals) / 10 ** decimals);
    setDraft(null);
    onCommit(next, String(next));
  };
  return (
    <div className="stepper">
      <label className="stepper-label" htmlFor={id}>
        {label} <span className="faint">({unit})</span>
      </label>
      <div className="stepper-row">
        <button type="button" className="step-btn" aria-label={`Decrease ${label}`} onClick={() => bump(-1)}>
          <IconMinus />
        </button>
        <input
          id={id}
          className="input input-num"
          inputMode="decimal"
          autoComplete="off"
          value={shown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) {
              onCommit(draft.trim() === '' ? null : Number(draft.replace(',', '.')), draft);
              setDraft(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button type="button" className="step-btn" aria-label={`Increase ${label}`} onClick={() => bump(1)}>
          <IconPlus />
        </button>
      </div>
      {error && (
        <p className="error xs" id={errId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}

const KIND_CLASS: Partial<Record<ChangeKind, 'up' | 'down'>> = { 'load-up': 'up', 'reps-up': 'up', 'sets-up': 'up', 'effort-down': 'up', regression: 'down' };

/** A comparison label with an arrow; never shown without real previous data. */
export function ChangeLabel({ name, kind, label }: { name?: string; kind: ChangeKind; label: string }) {
  const dir = KIND_CLASS[kind];
  const Icon = dir === 'up' ? IconUp : dir === 'down' ? IconDown : IconDash;
  return (
    <span className={`change ${dir ?? ''}`}>
      <Icon size={14} />
      {name && <b>{name}</b>}
      <span className="delta">{label}</span>
    </span>
  );
}

export function StatusPill({ kind }: { kind: ChangeKind }) {
  const map: Record<ChangeKind, [string, string]> = {
    'load-up': ['pill-improved', 'Improved'],
    'reps-up': ['pill-improved', 'Improved'],
    'sets-up': ['pill-improved', 'Improved'],
    'effort-down': ['pill-improved', 'Easier'],
    stable: ['', 'Stable'],
    mixed: ['', 'Changed'],
    regression: ['pill-declined', 'Declined'],
    insufficient: ['pill-new', 'New'],
  };
  const [cls, text] = map[kind];
  return <span className={`pill ${cls}`}>{text}</span>;
}

export function Progress({ value, max, tone, label }: { value: number; max: number; tone?: 'amber' | 'violet'; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A titled run of settings rows, separated by hairlines (iOS-style grouped list, on paper). */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="settings-section" aria-labelledby={id}>
      <h2 id={id} className="settings-section-title">
        {title}
      </h2>
      <div className="settings-list">{children}</div>
    </section>
  );
}

export function SettingsGroup({ icon, title, subtitle, children, defaultOpen, id }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode; defaultOpen?: boolean; id?: string }) {
  return (
    <details className="settings-group" open={defaultOpen} id={id}>
      <summary>
        <span className="settings-icon">{icon}</span>
        <span className="settings-text">
          <span className="settings-title">{title}</span>
          <span className="settings-subtitle">{subtitle}</span>
        </span>
        <IconChevronDown size={18} className="chev" />
      </summary>
      <div className="settings-body">{children}</div>
    </details>
  );
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DayPicker({ legend, value, onChange }: { legend: string; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <fieldset className="field">
      <legend className="field-label">{legend}</legend>
      <div className="choices choices-row">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <label key={d} className="choice">
            <input type="checkbox" checked={value.includes(d)} onChange={(e) => onChange(e.target.checked ? [...value, d].sort() : value.filter((x) => x !== d))} />
            <span className="choice-body">
              <span className="choice-label">{WEEKDAY_LABELS[d]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
