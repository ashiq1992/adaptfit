import { useId, useState } from 'react';
import { EXERCISES, EXERCISES_BY_ID } from '../../content/exercises';
import { newId, saveImportedSessions } from '../../data/repo';
import { LOAD_TYPE_LABEL, usesLoad } from '../../domain/loads';
import { buildImportSessions, type ImportRow, type ImportSet, parseNotes, rowIssues } from '../../domain/notesImport';
import { LOAD_TYPES, type LoadType } from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { useApp } from '../../ui/DataContext';
import { navigate } from '../../ui/hooks';
import { IconBack } from '../../ui/icons';

const EXAMPLE = '2026-11-04\nUpper Body A\nSmith Bench 30 kg/side 3x8\nPull-ups BW 10, 9, 8\nRDL 20 kg each hand 3x10';

export function ImportScreen() {
  const { data } = useApp();
  const announce = useAnnounce();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [ignored, setIgnored] = useState<{ lineNo: number; raw: string; reason: string }[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const textId = useId();

  const parse = () => {
    const r = parseNotes(text, data.customExercises);
    setRows(r.rows);
    setIgnored(r.ignored);
    setResult(null);
  };
  const update = (id: string, patch: Partial<ImportRow>) => setRows((rs) => rs!.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const ready = rows?.filter((r) => r.include && rowIssues(r).length === 0) ?? [];
  const blocked = rows?.filter((r) => r.include && rowIssues(r).length > 0) ?? [];

  const save = async () => {
    setBusy(true);
    const built = buildImportSessions({ rows: ready, existing: data.sessions, newId, now: clock.now(), defaultUnit: data.profile.weightUnit, custom: data.customExercises });
    const { saved, duplicates } = await saveImportedSessions(built.sessions);
    const dup = duplicates + built.duplicates.length;
    const msg = `${saved} workout${saved === 1 ? '' : 's'} imported.${dup ? ` ${dup} duplicate${dup === 1 ? ' was' : 's were'} skipped.` : ''}`;
    setResult(msg);
    announce(msg);
    setBusy(false);
    if (saved > 0) setRows(null);
  };

  return (
    <div className="screen">
      <div className="row">
        <a href="#/train/history" className="btn btn-ghost btn-icon" aria-label="Back to History">
          <IconBack />
        </a>
        <div>
          <h1 tabIndex={-1}>Import notes</h1>
          <p className="small muted">Paste workouts from your notes app. You'll review everything before it's saved.</p>
        </div>
      </div>
      {result && (
        <div className="status-banner" role="status" data-testid="import-result">
          <span />
          <div className="row between wrap">
            <span className="small">{result}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/train/history')}>
              View history
            </button>
          </div>
        </div>
      )}
      {!rows ? (
        <section className="card">
          <div className="field">
            <label className="field-label" htmlFor={textId}>
              Workout notes
            </label>
            <textarea id={textId} className="textarea" value={text} placeholder={EXAMPLE} onChange={(e) => setText(e.target.value)} />
            <p className="field-hint">Put a date line (e.g. 2026-11-04 or 4 Nov 2026) above each workout. Write how the weight was loaded: “kg/side”, “each hand”, “total”, “BW”, “BW+10kg”, or “assisted 20 kg”.</p>
          </div>
          <div className="row wrap">
            <button type="button" className="btn btn-primary btn-grow" onClick={parse} disabled={!text.trim()}>
              Review import
            </button>
            <button type="button" className="btn btn-tertiary" onClick={() => setText(EXAMPLE)}>
              Use example
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="row between wrap">
            <span className="small muted num">
              {ready.length} ready · {blocked.length} need attention · {rows.filter((r) => !r.include).length} excluded
            </span>
            <button type="button" className="link-btn" onClick={() => setRows(null)}>
              Edit text
            </button>
          </div>
          {rows.length === 0 && <p className="muted">No exercise lines were recognised.</p>}
          <ol className="stack">
            {rows.map((r) => (
              <ImportRowEditor key={r.id} row={r} onChange={(p) => update(r.id, p)} />
            ))}
          </ol>
          {ignored.length > 0 && (
            <section className="card">
              <h2 className="card-title">Lines not imported</h2>
              <ul className="bullet-list">
                {ignored.map((i) => (
                  <li key={i.lineNo}>
                    Line {i.lineNo}: “{i.raw.trim()}” — {i.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <button type="button" className="btn btn-primary btn-lg" disabled={ready.length === 0 || blocked.length > 0 || busy} onClick={save}>
            Save {ready.length} exercise record{ready.length === 1 ? '' : 's'}
          </button>
          {blocked.length > 0 && <p className="xs amber">Resolve or exclude the highlighted rows to save. Nothing is guessed on your behalf.</p>}
        </>
      )}
    </div>
  );
}

function ImportRowEditor({ row, onChange }: { row: ImportRow; onChange: (p: Partial<ImportRow>) => void }) {
  const { data } = useApp();
  const issues = row.include ? rowIssues(row) : [];
  const ids = { d: useId(), e: useId(), l: useId(), u: useId(), s: useId(), w: useId() };
  const [setsText, setSetsText] = useState(row.sets.map((s) => (row.loadType === 'timed' ? s.durationSec : s.reps)).join(', '));
  const [loadText, setLoadText] = useState(row.sets[0]?.load != null ? String(row.sets[0].load) : '');
  const applySets = (measures: string, load: string) => {
    const nums = measures.split(/[,\s]+/).filter(Boolean).map(Number);
    const l = load.trim() === '' ? null : Number(load.replace(',', '.'));
    const sets: ImportSet[] = nums.map((n) => ({ reps: row.loadType === 'timed' ? null : n, durationSec: row.loadType === 'timed' ? n : null, load: Number.isFinite(l) && (l ?? 0) >= 0 ? l : null }));
    onChange({ sets });
  };
  return (
    <li className={`import-row ${issues.length ? 'has-issues' : ''}`} data-testid="import-row">
      <div className="row between wrap">
        <span className="xs faint">
          Line {row.lineNo}: “{row.raw.trim()}”
        </span>
        <label className="row xs">
          <input type="checkbox" checked={row.include} onChange={(e) => onChange({ include: e.target.checked })} /> Include
        </label>
      </div>
      <div className="form-grid">
        <div className="field">
          <label className="field-label xs" htmlFor={ids.d}>
            Date
          </label>
          <input id={ids.d} type="date" className="input" value={row.date ?? ''} aria-invalid={!row.date ? true : undefined} onChange={(e) => onChange({ date: e.target.value || null })} />
        </div>
        <div className="field">
          <label className="field-label xs" htmlFor={ids.e}>
            Exercise
          </label>
          <select
            id={ids.e}
            className="select"
            value={row.exerciseId ?? ''}
            aria-invalid={!row.exerciseId ? true : undefined}
            onChange={(e) => {
              const id = e.target.value || null;
              const lib = id ? EXERCISES_BY_ID.get(id) : undefined;
              const custom = data.customExercises.find((c) => c.id === id);
              onChange({ exerciseId: id, name: lib?.name ?? custom?.name ?? row.name, loadType: row.loadType ?? null, suggestedLoadType: lib?.loadType ?? custom?.loadType ?? null });
            }}
          >
            <option value="">{row.candidates.length ? 'Which variation?' : `Choose (“${row.name}”)`}</option>
            {row.candidates.map((c) => (
              <option key={`c-${c}`} value={c}>
                {EXERCISES_BY_ID.get(c)?.name}
              </option>
            ))}
            {data.customExercises.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {[...EXERCISES].sort((a, b) => a.name.localeCompare(b.name)).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label xs" htmlFor={ids.l}>
            Loading
          </label>
          <select id={ids.l} className="select" value={row.loadType ?? ''} aria-invalid={!row.loadType ? true : undefined} onChange={(e) => onChange({ loadType: (e.target.value || null) as LoadType | null })}>
            <option value="">{row.suggestedLoadType ? `Confirm (usually ${LOAD_TYPE_LABEL[row.suggestedLoadType].toLowerCase()})` : 'Choose…'}</option>
            {LOAD_TYPES.filter((t) => t !== 'unspecified').map((t) => (
              <option key={t} value={t}>
                {LOAD_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        {row.loadType && usesLoad(row.loadType) && (
          <>
            <div className="field">
              <label className="field-label xs" htmlFor={ids.w}>
                Load
              </label>
              <input
                id={ids.w}
                className="input"
                inputMode="decimal"
                value={loadText}
                onChange={(e) => {
                  setLoadText(e.target.value);
                  applySets(setsText, e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label className="field-label xs" htmlFor={ids.u}>
                Unit
              </label>
              <select id={ids.u} className="select" value={row.unit ?? ''} aria-invalid={!row.unit ? true : undefined} onChange={(e) => onChange({ unit: (e.target.value || null) as 'kg' | 'lb' | null })}>
                <option value="">Choose…</option>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
          </>
        )}
        <div className="field">
          <label className="field-label xs" htmlFor={ids.s}>
            {row.loadType === 'timed' ? 'Seconds per set' : 'Reps per set'}
          </label>
          <input
            id={ids.s}
            className="input"
            value={setsText}
            onChange={(e) => {
              setSetsText(e.target.value);
              applySets(e.target.value, loadText);
            }}
          />
        </div>
      </div>
      {issues.length > 0 && (
        <div className="issue-list">
          {issues.map((i) => (
            <span key={i} className="pill pill-pr">
              {i}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
