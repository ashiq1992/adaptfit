import { useEffect, useId, useMemo, useState } from 'react';
import { EXERCISES, EXERCISES_BY_ID } from '../../content/exercises';
import { newId, saveCustomExercise, saveProgramme } from '../../data/repo';
import { LOAD_TYPE_LABEL, usesPlannedLoad } from '../../domain/loads';
import { parseRoutine } from '../../domain/notesImport';
import { createProgramme, duplicateDay, estimateDayMinutes, programmeExercise, validateProgramme } from '../../domain/programme';
import { LOAD_TYPES, type LoadType, type Programme, type ProgrammeDay, type ProgrammeExercise } from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { RadioGroup } from '../../ui/ChoiceGroup';
import { clock } from '../../ui/clock';
import { DayPicker } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { Dialog } from '../../ui/Dialog';
import { navigate } from '../../ui/hooks';
import { IconBack, IconChevronDown, IconDown, IconPlus, IconTrash, IconUp } from '../../ui/icons';
import { GOAL_CHOICES } from '../onboarding/choices';
import { PlannedLoadField } from './PlannedLoadField';

export function ProgrammeEditor({ id, openImport }: { id: string; openImport?: boolean }) {
  const { data } = useApp();
  const existing = data.programmes.find((p) => p.id === id);
  const [draft, setDraft] = useState<Programme | null>(null);
  useEffect(() => {
    if (draft) return;
    if (existing) setDraft(structuredClone(existing));
    else if (id === 'new')
      setDraft(createProgramme(newId, clock.now(), { name: '', goal: data.profile.goal, days: [{ id: newId(), name: 'Day 1', exercises: [] }], daysPerWeek: 3 }));
  }, [existing, id, draft, data.profile.goal]);

  if (!draft) {
    return (
      <div className="screen">
        <h1 tabIndex={-1}>Programme not found</h1>
        <a href="#/settings" className="btn btn-primary">
          Back to Settings
        </a>
      </div>
    );
  }
  return <Editor draft={draft} setDraft={setDraft} isNew={!existing} openImport={openImport} />;
}

function Editor({ draft, setDraft, isNew, openImport }: { draft: Programme; setDraft: (p: Programme) => void; isNew: boolean; openImport?: boolean }) {
  const { data } = useApp();
  const announce = useAnnounce();
  const [activate, setActivate] = useState(isNew || draft.isActive || !data.activeProgramme);
  const [errors, setErrors] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(!!openImport);
  const nameId = useId();
  const update = (patch: Partial<Programme>) => setDraft({ ...draft, ...patch });
  const updateDay = (dayId: string, fn: (d: ProgrammeDay) => ProgrammeDay) => update({ days: draft.days.map((d) => (d.id === dayId ? fn(d) : d)) });

  const save = async () => {
    const unresolved = draft.days.flatMap((d) => d.exercises.filter((e) => !e.exerciseId).map((e) => `${d.name}: choose an exercise for "${e.name}".`));
    const issues = [...validateProgramme(draft).map((i) => i.message), ...unresolved];
    setErrors(issues);
    if (issues.length) {
      announce(`${issues.length} item${issues.length === 1 ? '' : 's'} to fix before saving.`);
      return;
    }
    // Drop review-only fields (e.g. import candidates) before persisting.
    const days = draft.days.map((d) => ({
      ...d,
      exercises: d.exercises.map(({ id: exId, exerciseId, name, loadType, sets, repMin, repMax, durationSec, restSec, priority, notes, plannedLoad }) => ({ id: exId, exerciseId, name, loadType, sets, repMin, repMax, durationSec, restSec, priority, notes, plannedLoad: usesPlannedLoad(loadType) ? plannedLoad : null })),
    }));
    await saveProgramme({ ...draft, days, updatedAt: clock.now().toISOString() }, { activate });
    announce('Programme saved.');
    navigate('/train');
  };

  return (
    <div className="screen">
      <div className="row">
        <a href="#/settings" className="btn btn-ghost btn-icon" aria-label="Back to Settings">
          <IconBack />
        </a>
        <h1 tabIndex={-1}>{isNew ? 'New programme' : 'Edit programme'}</h1>
      </div>
      {draft.source === 'starter' && <p className="small amber">Example programme — edit it to match the routine you actually follow.</p>}
      {isNew && (
        <a href="#/programmes/guide" className="link-btn">
          Not sure what to build? Get a recommended programme →
        </a>
      )}

      <section className="card">
        <div className="field">
          <label className="field-label" htmlFor={nameId}>
            Programme name
          </label>
          <input id={nameId} className="input" value={draft.name} placeholder="e.g. Upper / Lower" onChange={(e) => update({ name: e.target.value })} />
        </div>
        <RadioGroup legend="Goal" name="pe-goal" choices={GOAL_CHOICES} value={draft.goal} onChange={(v) => update({ goal: v })} />
        <RadioGroup legend="Sessions per week" name="pe-days" choices={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))} value={draft.daysPerWeek} onChange={(v) => update({ daysPerWeek: v })} />
        <DayPicker legend="Preferred weekdays (optional)" value={draft.preferredWeekdays} onChange={(v) => update({ preferredWeekdays: v })} />
      </section>

      <div className="row between">
        <h2 className="card-title">Training days</h2>
        <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setImportOpen(true)}>
          Import routine text
        </button>
      </div>

      {draft.days.map((day, di) => (
        <DayEditor
          key={day.id}
          day={day}
          index={di}
          count={draft.days.length}
          onChange={(fn) => updateDay(day.id, fn)}
          onDuplicate={() => {
            const copy = duplicateDay(day, newId);
            const days = [...draft.days];
            days.splice(di + 1, 0, copy);
            update({ days });
            announce(`${day.name} duplicated.`);
          }}
          onDelete={() => update({ days: draft.days.filter((d) => d.id !== day.id) })}
          onMove={(dir) => {
            const days = [...draft.days];
            const [d] = days.splice(di, 1);
            days.splice(di + dir, 0, d!);
            update({ days });
          }}
        />
      ))}
      <button type="button" className="btn btn-tertiary" onClick={() => update({ days: [...draft.days, { id: newId(), name: `Day ${draft.days.length + 1}`, exercises: [] }] })}>
        <IconPlus size={18} /> Add training day
      </button>

      <section className="card">
        <label className="switch">
          <span className="strong">Use as my active programme</span>
          <input type="checkbox" role="switch" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
        </label>
        {errors.length > 0 && (
          <ul className="bullet-list" role="alert" style={{ color: 'var(--danger)' }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={save}>
          Save programme
        </button>
        <p className="xs muted">Editing a programme never changes past workouts — each session keeps its own record.</p>
      </section>

      {importOpen && (
        <RoutineImportDialog
          onClose={() => setImportOpen(false)}
          onImport={(days) => {
            const keepExisting = draft.days.filter((d) => d.exercises.length > 0);
            update({ days: [...keepExisting, ...days], source: draft.source === 'starter' ? 'imported' : draft.source });
            setImportOpen(false);
            announce(`${days.length} day${days.length === 1 ? '' : 's'} imported. Review them before saving.`);
          }}
        />
      )}
    </div>
  );
}

function ExerciseSelect({ value, onChange, candidates, label }: { value: string; onChange: (id: string) => void; candidates?: string[]; label: string }) {
  const { data } = useApp();
  const id = useId();
  const sorted = useMemo(() => [...EXERCISES].sort((a, b) => a.name.localeCompare(b.name)), []);
  return (
    <div className="field">
      <label className="field-label xs" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!value ? true : undefined}>
        <option value="">Choose an exercise…</option>
        {candidates && candidates.length > 0 && (
          <optgroup label="Which variation?">
            {candidates.map((c) => (
              <option key={`c-${c}`} value={c}>
                {EXERCISES_BY_ID.get(c)?.name ?? c}
              </option>
            ))}
          </optgroup>
        )}
        {data.customExercises.length > 0 && (
          <optgroup label="My exercises">
            {data.customExercises.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Library">
          {sorted.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </optgroup>
        <option value="__custom">+ New custom exercise…</option>
      </select>
    </div>
  );
}

function DayEditor({ day, index, count, onChange, onDuplicate, onDelete, onMove }: { day: ProgrammeDay; index: number; count: number; onChange: (fn: (d: ProgrammeDay) => ProgrammeDay) => void; onDuplicate: () => void; onDelete: () => void; onMove: (dir: 1 | -1) => void }) {
  const { data } = useApp();
  const [customFor, setCustomFor] = useState<string | null>(null);
  const nameId = useId();
  const setEx = (exId: string, patch: Partial<ProgrammeExercise>) => onChange((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) }));
  const moveEx = (i: number, dir: 1 | -1) =>
    onChange((d) => {
      const ex = [...d.exercises];
      const [e] = ex.splice(i, 1);
      ex.splice(i + dir, 0, e!);
      return { ...d, exercises: ex };
    });
  const choose = (pe: ProgrammeExercise, exerciseId: string) => {
    if (exerciseId === '__custom') return setCustomFor(pe.id);
    const lib = EXERCISES_BY_ID.get(exerciseId);
    const custom = data.customExercises.find((c) => c.id === exerciseId);
    const loadType = lib?.loadType ?? custom?.loadType ?? pe.loadType;
    setEx(pe.id, { exerciseId, name: lib?.name ?? custom?.name ?? pe.name, loadType, plannedLoad: loadType === pe.loadType ? pe.plannedLoad : null, ...(loadType === 'timed' ? { repMin: null, repMax: null, durationSec: pe.durationSec ?? 60 } : { durationSec: null, repMin: pe.repMin ?? 8, repMax: pe.repMax ?? 12 }) });
  };
  return (
    <details className="card day-card" open={index === 0 || day.exercises.length === 0}>
      <summary className="row between">
        <span>
          <span className="strong">{day.name || `Day ${index + 1}`}</span>
          <span className="xs muted num" style={{ display: 'block' }}>
            {day.exercises.length} exercises · ~{estimateDayMinutes(day)} min
          </span>
        </span>
        <IconChevronDown />
      </summary>
      <div className="stack" style={{ marginTop: 12 }}>
        <div className="field">
          <label className="field-label" htmlFor={nameId}>
            Day name
          </label>
          <input id={nameId} className="input" value={day.name} onChange={(e) => onChange((d) => ({ ...d, name: e.target.value }))} />
        </div>
        {day.exercises.map((pe, i) => (
          <div key={pe.id} className="pe-row" data-testid="programme-exercise">
            <ExerciseSelect label={`Exercise ${i + 1}`} value={pe.exerciseId} candidates={(pe as ProgrammeExercise & { candidates?: string[] }).candidates} onChange={(v) => choose(pe, v)} />
            {!pe.exerciseId && <p className="xs amber">“{pe.name}” — choose which exercise this is.</p>}
            <div className="pe-grid">
              <label className="field">
                <span className="field-label xs">Loading</span>
                <select className="select" value={pe.loadType} onChange={(e) => setEx(pe.id, { loadType: e.target.value as LoadType, plannedLoad: null, ...(e.target.value === 'timed' ? { repMin: null, repMax: null, durationSec: 60 } : { durationSec: null, repMin: pe.repMin ?? 8, repMax: pe.repMax ?? 12 }) })}>
                  {LOAD_TYPES.filter((t) => t !== 'unspecified' || pe.loadType === 'unspecified').map((t) => (
                    <option key={t} value={t}>
                      {LOAD_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <NumField label="Sets" value={pe.sets} onChange={(v) => setEx(pe.id, { sets: v ?? 1 })} />
              {pe.loadType === 'timed' ? (
                <NumField label="Seconds" value={pe.durationSec} onChange={(v) => setEx(pe.id, { durationSec: v })} />
              ) : (
                <>
                  <NumField label="Min reps" value={pe.repMin} onChange={(v) => setEx(pe.id, { repMin: v })} />
                  <NumField label="Max reps" value={pe.repMax} onChange={(v) => setEx(pe.id, { repMax: v })} />
                </>
              )}
              <NumField label="Rest (s)" value={pe.restSec} onChange={(v) => setEx(pe.id, { restSec: v ?? 0 })} />
            </div>
            <PlannedLoadField loadType={pe.loadType} value={pe.plannedLoad ?? null} defaultUnit={data.profile.weightUnit} exerciseName={pe.name} onChange={(v) => setEx(pe.id, { plannedLoad: v })} />
            <div className="row between wrap">
              <label className="choice">
                <input type="checkbox" checked={pe.priority} onChange={(e) => setEx(pe.id, { priority: e.target.checked })} />
                <span className="choice-body" style={{ minHeight: 36, padding: '4px 12px' }}>
                  <span className="choice-label">★ Priority lift</span>
                </span>
              </label>
              <div className="row">
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Move ${pe.name} up`} disabled={i === 0} onClick={() => moveEx(i, -1)}>
                  <IconUp size={18} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Move ${pe.name} down`} disabled={i === day.exercises.length - 1} onClick={() => moveEx(i, 1)}>
                  <IconDown size={18} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove ${pe.name}`} onClick={() => onChange((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== pe.id) }))}>
                  <IconTrash size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => onChange((d) => ({ ...d, exercises: [...d.exercises, { ...programmeExercise(newId, { exerciseId: '' }), name: 'New exercise' }] }))}>
          <IconPlus size={18} /> Add exercise
        </button>
        <div className="row wrap">
          <button type="button" className="btn btn-tertiary btn-sm" onClick={onDuplicate}>
            Duplicate day
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={index === 0} onClick={() => onMove(-1)}>
            Move up
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={index === count - 1} onClick={() => onMove(1)}>
            Move down
          </button>
          <button type="button" className="btn btn-danger-outline btn-sm" disabled={count === 1} onClick={onDelete}>
            Delete day
          </button>
        </div>
      </div>
      {customFor && (
        <CustomExerciseDialog
          onClose={() => setCustomFor(null)}
          onCreate={(c) => {
            setEx(customFor, { exerciseId: c.id, name: c.name, loadType: c.loadType, ...(c.loadType === 'timed' ? { repMin: null, repMax: null, durationSec: 60 } : {}) });
            setCustomFor(null);
          }}
        />
      )}
    </details>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label xs" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input input-num"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (t === '') return onChange(null);
          if (/^\d+$/.test(t)) onChange(Number(t));
        }}
      />
    </div>
  );
}

function CustomExerciseDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (c: { id: string; name: string; loadType: LoadType }) => void }) {
  const [name, setName] = useState('');
  const [loadType, setLoadType] = useState<LoadType>('total');
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const create = async () => {
    if (!name.trim()) return setError('Enter a name.');
    const c = { id: `custom-${newId()}`, name: name.trim().slice(0, 80), loadType, tags: ['strength' as const], createdAt: clock.now().toISOString() };
    await saveCustomExercise(c);
    onCreate(c);
  };
  return (
    <Dialog
      title="New custom exercise"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-tertiary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={create}>
            Create
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor={id}>
          Exercise name
        </label>
        <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hack squat" />
      </div>
      <RadioGroup
        legend="How is load recorded?"
        name="custom-load"
        layout="cards"
        choices={LOAD_TYPES.filter((t) => t !== 'unspecified').map((t) => ({ value: t, label: LOAD_TYPE_LABEL[t] }))}
        value={loadType}
        onChange={setLoadType}
        description="Loads are only compared with sessions recorded the same way. Bar weight is never assumed."
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function RoutineImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (days: ProgrammeDay[]) => void }) {
  const { data } = useApp();
  const [text, setText] = useState('');
  const id = useId();
  const parsed = useMemo(() => parseRoutine(text, data.customExercises), [text, data.customExercises]);
  const toDays = (): ProgrammeDay[] =>
    parsed.days.map((d) => ({
      id: newId(),
      name: d.name,
      exercises: d.lines.map((l) => ({
        ...programmeExercise(newId, {
          exerciseId: l.exerciseId ?? '',
          name: l.name,
          loadType: l.loadType ?? (l.exerciseId ? undefined : 'unspecified'),
          sets: l.sets,
          repMin: l.repMin,
          repMax: l.repMax,
          durationSec: l.durationSec,
        }),
        candidates: l.candidates,
      })),
    }));
  return (
    <Dialog
      title="Import a routine"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-tertiary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={parsed.days.length === 0} onClick={() => onImport(toDays())}>
            Add {parsed.days.length} day{parsed.days.length === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor={id}>
          Paste your routine
        </label>
        <textarea
          id={id}
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Upper Body A\nSmith bench 3x6-10\nLat pulldown 3x8-12\nSeated cable row 3x8-12\nLateral raises 3x12-15'}
        />
        <p className="field-hint">One heading per day, then “Exercise sets×reps” lines. Unknown or ambiguous names are flagged for you to choose — nothing is guessed.</p>
      </div>
      {parsed.days.map((d) => (
        <div key={d.name} className="stack-sm">
          <span className="strong small">{d.name}</span>
          <ul className="bullet-list">
            {d.lines.map((l) => (
              <li key={l.raw}>
                {l.exerciseId ? l.name : <span className="amber">{l.name} (choose exercise)</span>} — {l.sets} × {l.durationSec ? `${l.durationSec}s` : `${l.repMin}–${l.repMax}`}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {parsed.ignored.length > 0 && <p className="xs muted">Not recognised: {parsed.ignored.join(' · ')}</p>}
    </Dialog>
  );
}
