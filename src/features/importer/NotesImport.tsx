import { useId, useMemo, useState } from 'react';
import { AutoTextarea } from '../../ui/AutoTextarea';
import { EXERCISES_BY_ID } from '../../content/exercises';
import { findImportByHash, getTrainingWeek, newId, saveImportRecord } from '../../data/repo';
import { getDb } from '../../data/db';
import { isLocalDate } from '../../domain/dates';
import { entryKey, fillWeek, historyRecords, importHash, importIssues, type ImportMode, type Resolutions, resolveNote, templateDays } from '../../domain/importer';
import { LOAD_TYPE_LABEL } from '../../domain/loads';
import { noteLoad, performanceText, setsReps } from '../../domain/noteFormat';
import { type NoteEntry, parseNote, performanceSets } from '../../domain/noteParser';
import { createProgramme } from '../../domain/programme';
import { weekStartOf } from '../../domain/progression';
import type { CustomExercise, LoadType, WeightUnit } from '../../domain/types';
import { buildWeekDraft, previousConfirmedWeek } from '../../domain/weekly';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { useApp } from '../../ui/DataContext';
import { navigate, useLive } from '../../ui/hooks';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { longDate } from '../format';

const PLACEHOLDER = `Tuesday Upper
Bench 30kg/side 8 8 7
Pulldown 45kg 10 10 9
Rows 40kg 10x3

Saturday Lower
Squat 35kg/side 6x4
RDL 20kg each hand 10x3`;

const MODES: { id: ImportMode; label: string; hint: string }[] = [
  { id: 'template', label: 'Use as my workout plan', hint: 'Creates a workout note you can edit.' },
  { id: 'history', label: 'Add to my training history', hint: 'Records past workouts (needs a date, or mark undated).' },
  { id: 'week', label: 'Fill in this week’s update', hint: 'Puts the values into this week’s draft for you to confirm.' },
];

const CONVENTIONS: LoadType[] = ['total', 'per-side', 'per-dumbbell', 'bodyweight-plus', 'assisted'];

/** Paste a workout from Notes, review how it was read, then save it. */
export function NotesImport() {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const ids = useId();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ImportMode>(data.activeProgramme ? 'week' : 'template');
  const [date, setDate] = useState('');
  const [undated, setUndated] = useState(false);
  const [res, setRes] = useState<Resolutions>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctx = useMemo(() => ({ custom: data.customExercises, defaultUnit: data.profile.weightUnit }), [data.customExercises, data.profile.weightUnit]);
  const parsed = useMemo(() => resolveNote(parseNote(text, ctx), res), [text, ctx, res]);
  const validDate = date && isLocalDate(date) && date <= today ? date : null;
  const issues = text.trim() ? importIssues(parsed, mode, { date: validDate, undated }) : [];
  const blocking = issues.filter((i) => i.blocking);
  const hash = importHash(text, mode);
  const dup = useLive(() => (text.trim() ? findImportByHash(hash) : Promise.resolve(undefined)), [hash, text]);
  const duplicate = dup.data ?? null;

  const entries = parsed.days.reduce((n, d) => n + d.entries.length, 0);
  const preserved = parsed.preamble.length + parsed.days.reduce((n, d) => n + d.notes.length + d.entries.reduce((m, e) => m + e.comments.length, 0), 0);
  const review = parsed.days.reduce((n, d) => n + d.entries.filter((e) => e.uncertain.some((u) => u !== 'sets' && u !== 'reps') || e.assumptions.length).length, 0);
  const setRes1 = (key: string, patch: Resolutions[string]) => setRes((r) => ({ ...r, [key]: { ...r[key], ...patch } }));

  const save = async () => {
    if (blocking.length || duplicate) return;
    setBusy(true);
    setError(null);
    const now = clock.now();
    const created: CustomExercise[] = [];
    const c = { newId, unit: data.profile.weightUnit, custom: data.customExercises, created, now };
    try {
      if (mode === 'template') {
        const days = templateDays(parsed, c);
        const activate = !data.activeProgramme;
        const p = { ...createProgramme(newId, now, { name: parsed.preamble[0]?.slice(0, 80) || 'My training plan', goal: data.profile.goal, days, daysPerWeek: Math.max(1, Math.min(7, days.length)), preferredWeekdays: parsed.days.map((d) => d.weekday).filter((w): w is number => w !== null), source: 'imported' }), notes: parsed.preamble.slice(1).join('\n'), isActive: activate };
        const r = await saveImportRecord({ id: newId(), hash, mode, createdAt: now.toISOString(), localDate: null, text: text.slice(0, 20_000), resultIds: [p.id], undated: [] }, async () => {
          for (const x of created) await getDb().customExercises.put(x);
          await getDb().programmes.put(p);
        });
        if (!r.saved) throw new Error('This exact note was already imported.');
        announce('Imported as a workout note.');
        navigate(`/note/${encodeURIComponent(p.id)}`);
      } else if (mode === 'history') {
        const out = historyRecords(parsed, { date: validDate, undated, hash, now, unit: data.profile.weightUnit }, c);
        const r = await saveImportRecord({ id: newId(), hash, mode, createdAt: now.toISOString(), localDate: undated ? null : validDate, text: text.slice(0, 20_000), resultIds: out.sessions.map((s) => s.id), undated: out.undated }, async () => {
          for (const x of created) await getDb().customExercises.put(x);
          for (const s of out.sessions) await getDb().sessions.add(s);
        });
        if (!r.saved) throw new Error('This exact note was already imported.');
        announce(undated ? `Saved ${out.undated.length} undated values as a reference. They aren’t used in trends.` : `Added ${out.sessions.length} workout${out.sessions.length === 1 ? '' : 's'} to your history.`);
        navigate(undated ? '/plan' : '/history');
      } else {
        const ws = weekStartOf(today);
        let week = (await getTrainingWeek(ws)) ?? null;
        if (week?.status === 'confirmed') throw new Error('This week is already confirmed. Edit it from Previous weeks instead.');
        week ??= buildWeekDraft({ weekStart: ws, programme: data.activeProgramme, weekPlans: data.weekPlans, previousWeek: previousConfirmedWeek(data.trainingWeeks, ws), sessions: data.sessions, imports: data.imports, now, unit: data.profile.weightUnit, copy: false });
        const filled = fillWeek(week, parsed, c);
        const r = await saveImportRecord({ id: newId(), hash, mode, createdAt: now.toISOString(), localDate: ws, text: text.slice(0, 20_000), resultIds: [ws], undated: [] }, async () => {
          await getDb().trainingWeeks.put({ ...filled.week, updatedAt: now.toISOString() });
        });
        if (!r.saved) throw new Error('This exact note was already imported.');
        announce(`Filled ${filled.matched} exercise${filled.matched === 1 ? '' : 's'}${filled.unmatched.length ? `; not in your plan: ${filled.unmatched.join(', ')}` : ''}. Mark the sessions you did, then confirm.`);
        navigate('/week');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen import-screen">
      <ScreenHeader back={{ href: '#/plan', label: 'Plan' }} title="Import from Notes" subtitle="Paste a workout from Apple Notes, Google Keep, or anywhere. You review everything before it’s saved." />
      <div className="field">
        <label className="field-label" htmlFor={`${ids}-text`}>
          Workout note
        </label>
        <AutoTextarea
          id={`${ids}-text`}
          className="textarea note-paste"
          value={text}
          rows={8}
          placeholder={PLACEHOLDER}
          onChange={(e) => {
            setText(e.target.value);
            setRes({});
          }}
          data-testid="import-text"
        />
      </div>

      <fieldset className="field">
        <legend className="field-label">Import as</legend>
        <div className="stack-sm">
          {MODES.map((m) => (
            <label key={m.id} className="choice">
              <input type="radio" name={`${ids}-mode`} checked={mode === m.id} onChange={() => setMode(m.id)} disabled={m.id === 'week' && !data.activeProgramme} />
              <span className="choice-body">
                <span className="choice-label">{m.label}</span>
                <span className="choice-hint">{m.id === 'week' && !data.activeProgramme ? 'Needs a current workout note first.' : m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'history' && (
        <div className="field">
          <label className="field-label" htmlFor={`${ids}-date`}>
            Date of these workouts
          </label>
          <input id={`${ids}-date`} type="date" className="input" value={date} max={today} disabled={undated} onChange={(e) => setDate(e.target.value)} />
          <p className="field-hint">Dates written in the note (e.g. “12 Oct 2026”) are used for those days. AdaptFit never guesses a date.</p>
          <label className="check-row">
            <input type="checkbox" checked={undated} onChange={(e) => setUndated(e.target.checked)} />
            <span>I don’t know the date — keep the values as an undated reference (not used in trends)</span>
          </label>
        </div>
      )}

      {text.trim() && (
        <section className="card" aria-labelledby={`${ids}-prev`} data-testid="import-preview">
          <h2 id={`${ids}-prev`}>Preview</h2>
          <p className="small muted" data-testid="import-summary">
            {entries} exercise{entries === 1 ? '' : 's'} in {parsed.days.length} day{parsed.days.length === 1 ? '' : 's'} recognised
            {review ? ` · ${review} to check` : ''}
            {preserved ? ` · ${preserved} line${preserved === 1 ? '' : 's'} kept as notes` : ''}
          </p>
          {parsed.days.map((d, di) => (
            <div key={`${d.heading}-${di}`} className="import-day">
              <h3 className="note-day-label">
                {d.heading}
                {d.date && <span className="muted small"> · {longDate(d.date)}</span>}
              </h3>
              <ul className="note-lines">
                {d.entries.map((e, ei) => (
                  <EntryPreview key={ei} e={e} k={entryKey(di, ei)} unit={data.profile.weightUnit} onResolve={setRes1} />
                ))}
              </ul>
              {d.notes.length > 0 && <p className="note-ex-notes">Kept as notes: {d.notes.join(' · ')}</p>}
            </div>
          ))}
          {parsed.preamble.length > 0 && <p className="note-ex-notes">Kept as text: {parsed.preamble.join(' · ')}</p>}
          {parsed.unparsed.length > 0 && <p className="xs muted">Not understood (kept as notes, not used for analysis): {parsed.unparsed.map((u) => `line ${u.lineNo}`).join(', ')}.</p>}
          {issues.length > 0 && (
            <ul className="stack-sm" aria-label="Needs review">
              {issues.map((i, n) => (
                <li key={n} className={i.blocking ? 'error' : 'small attention-text'}>
                  {i.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {duplicate && (
        <p className="error" role="alert">
          You imported this exact note on {longDate(duplicate.createdAt.slice(0, 10))}. It wasn’t imported again.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!text.trim() || busy || blocking.length > 0 || !!duplicate} onClick={() => void save()} data-testid="import-save">
        {mode === 'template' ? 'Create workout note' : mode === 'history' ? 'Add to history' : 'Fill this week’s draft'}
      </button>
    </div>
  );
}

function EntryPreview({ e, k, unit, onResolve }: { e: NoteEntry; k: string; unit: WeightUnit; onResolve: (key: string, patch: Resolutions[string]) => void }) {
  const v = e.values;
  const lt = e.loadType ?? e.suggestedLoadType ?? 'total';
  const u = e.unit ?? unit;
  const unsure = e.loadType ? '' : ' (?)';
  // What was done, set by set ("60 kg × 8; 65 kg × 6"), exactly as written.
  const logged = v && (v.reps.length > 0 || v.durations.length > 0) ? performanceText(performanceSets(v, lt), lt, u) + (v.load != null ? unsure : '') : '';
  // The plan ("4 × 6"), when one was written next to it.
  const hasPlan = !!v && (v.repMin !== null || v.durationSec !== null || (v.sets !== null && !logged));
  const planSets = hasPlan ? setsReps({ sets: v.sets ?? v.reps.length, repMin: v.repMin, repMax: v.repMax, durationSec: v.durationSec, loadType: lt, uncertain: v.sets === null ? ['sets'] : [] }) : '';
  const planLoad = v?.load != null ? noteLoad(v.load, lt, u) + unsure : lt === 'bodyweight' ? 'bodyweight' : '';
  const plan = hasPlan ? [planSets, planLoad].filter(Boolean).join(' — ') : '';
  return (
    <li className="note-line import-entry">
      <span className="note-ex-name">
        {e.name}
        {!e.known && !e.candidates.length && <span className="tag">new exercise</span>}
      </span>
      <span className="note-ex-pres">{plan || logged || <span className="faint">No sets or reps found</span>}</span>
      {plan && logged && (
        <span className="note-ex-last">
          <span className="when">Did</span>
          {logged}
        </span>
      )}
      {v?.restSec != null && <span className="xs muted">Rest {v.restSec % 60 === 0 ? `${v.restSec / 60} min` : `${v.restSec} s`}</span>}
      {e.loadType && v?.load != null && <span className="xs muted">Loading: {LOAD_TYPE_LABEL[e.loadType]}</span>}
      {e.comments.length > 0 && <span className="note-ex-notes">{e.comments.join(' · ')}</span>}
      {e.uncertain.includes('exercise') && (
        <div className="clarify" role="group" aria-label={`Which exercise is “${e.name}”?`}>
          <span className="clarify-q">Which exercise is “{e.name}”?</span>
          <div className="clarify-options">
            {e.candidates.map((id) => (
              <button key={id} type="button" className="btn btn-tertiary btn-sm" onClick={() => onResolve(k, { exerciseId: id })}>
                {EXERCISES_BY_ID.get(id)?.name ?? id}
              </button>
            ))}
            <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onResolve(k, { exerciseId: null })}>
              Keep “{e.name}”
            </button>
          </div>
        </div>
      )}
      {e.uncertain.includes('loadType') && (
        <div className="clarify" role="group" aria-label={`How is the load for ${e.name} measured?`}>
          <span className="clarify-q">
            “{v?.loads?.length ? v.loads.filter((l) => l !== null).join(' / ') : v?.load} {e.unit ?? ''}” — total, per side, or per dumbbell?
          </span>
          <div className="clarify-options">
            {CONVENTIONS.map((t) => (
              <button key={t} type="button" className={`btn btn-sm ${e.suggestedLoadType === t ? 'btn-secondary' : 'btn-tertiary'}`} onClick={() => onResolve(k, { loadType: t })}>
                {LOAD_TYPE_LABEL[t].replace(' (assistance amount)', '')}
              </button>
            ))}
          </div>
        </div>
      )}
      {e.uncertain.includes('unit') && (
        <div className="clarify" role="group" aria-label={`Unit for ${e.name}`}>
          <span className="clarify-q">kg or lb?</span>
          <div className="clarify-options">
            {(['kg', 'lb'] as const).map((u) => (
              <button key={u} type="button" className="btn btn-tertiary btn-sm" onClick={() => onResolve(k, { unit: u })}>
                {u}
              </button>
            ))}
          </div>
        </div>
      )}
      {e.assumptions.map((a) => (
        <div key={a} className="clarify">
          <span className="clarify-q">{a}</span>
          {/as \d+ sets of/i.test(a) && (
            <div className="clarify-options">
              <button type="button" className="btn btn-tertiary btn-sm" onClick={() => onResolve(k, { swap: true })}>
                Swap sets and reps
              </button>
            </div>
          )}
        </div>
      ))}
    </li>
  );
}
