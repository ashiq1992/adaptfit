import { useEffect, useMemo, useRef, useState } from 'react';
import { EXERCISES_BY_ID } from '../../content/exercises';
import { EQUIPMENT_ACCESS_LABEL, PROGRAMME_TEMPLATES, TEMPLATES_BY_ID } from '../../content/programmeLibrary';
import { SOURCES_BY_ID } from '../../content/sources';
import { newId, saveProfile, saveProgramme } from '../../data/repo';
import { defaultAnswers, evaluateTemplate, type GuidedAnswers, modesFromAccess, programmeFromRecommendation, recommendProgrammes, swapExercise, type TemplateRecommendation } from '../../domain/guided';
import { estimateDayMinutes, validateProgramme } from '../../domain/programme';
import { plural } from '../../domain/schedule';
import { EQUIPMENT_ACCESS, MUSCLE_PRIORITIES, type MusclePriority, type Programme, type ProgrammeDay, type ProgrammeExercise, SESSION_LENGTHS } from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { CheckboxGroup, RadioGroup } from '../../ui/ChoiceGroup';
import { clock } from '../../ui/clock';
import { DayPicker, Switch } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { navigate } from '../../ui/hooks';
import { IconCheck, IconClock, IconInfo } from '../../ui/icons';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { hashParams, repRange } from '../format';
import { EXPERIENCE_CHOICES, GOAL_CHOICES } from '../onboarding/choices';
import { PlannedLoadField } from './PlannedLoadField';

type Step = 'goal' | 'experience' | 'availability' | 'equipment' | 'priorities' | 'results' | 'customise' | 'saved';
const QUESTIONS: Step[] = ['goal', 'experience', 'availability', 'equipment', 'priorities'];

const PRIORITY_LABEL: Record<MusclePriority, string> = { chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', legs: 'Legs', glutes: 'Glutes', 'full-body': 'Full-body balance' };
const EQUIPMENT_HINT = { 'full-gym': 'Machines, cables, barbells, dumbbells', 'dumbbells-bench': 'Adjustable dumbbells and a bench', 'basic-home': 'A few dumbbells, no bench', bodyweight: 'No equipment' } as const;

/** Exercises a user can choose to avoid (those used by the starter library). */
const AVOIDABLE = [...new Set(PROGRAMME_TEMPLATES.flatMap((t) => t.days.flatMap((d) => d.slots.flatMap((s) => s.options))))]
  .map((id) => EXERCISES_BY_ID.get(id)!)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

export function GuidedProgramme() {
  const { data } = useApp();
  const announce = useAnnounce();
  const [step, setStep] = useState<Step>('goal');
  const [answers, setAnswers] = useState<GuidedAnswers>(() => defaultAnswers(data.profile, data.activeProgramme));
  const [compare, setCompare] = useState(false);
  const [chosen, setChosen] = useState<TemplateRecommendation | null>(null);
  const [draft, setDraft] = useState<Programme | null>(null);
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [activate, setActivate] = useState(!data.activeProgramme);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<Programme | null>(null);
  const set = (patch: Partial<GuidedAnswers>) => setAnswers((a) => ({ ...a, ...patch }));

  // Opened from the library with a chosen template: go straight to preview and customise.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current) return;
    preselected.current = true;
    const id = hashParams().get('template');
    const t = id ? TEMPLATES_BY_ID.get(id) : undefined;
    if (t) choose(evaluateTemplate(t, answers, newId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => (step === 'results' || step === 'customise' ? recommendProgrammes(answers, newId) : []), [answers, step]);
  const qIndex = QUESTIONS.indexOf(step);

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  const choose = (rec: TemplateRecommendation) => {
    const p = programmeFromRecommendation(rec, answers, newId, clock.now());
    const opts: Record<string, string[]> = {};
    p.days.forEach((d, di) =>
      d.exercises.forEach((e, ei) => {
        const original = rec.days[di]?.exercises[ei];
        opts[e.id] = [e.exerciseId, ...((original && rec.alternatives[original.id]) ?? [])];
      }),
    );
    setChosen(rec);
    setDraft(p);
    setOptions(opts);
    go('customise');
  };

  const save = async () => {
    if (!draft) return;
    const issues = validateProgramme(draft).map((i) => i.message);
    setErrors(issues);
    if (issues.length) return announce(`${issues.length} ${plural(issues.length, 'item')} to fix before saving.`);
    const now = clock.now();
    const programme = { ...draft, updatedAt: now.toISOString() };
    await saveProgramme(programme, { activate });
    // Remember the answers so the questionnaire and other features can reuse them.
    await saveProfile({
      ...data.profile,
      goal: answers.goal,
      experience: answers.experience,
      preferredMinutes: answers.sessionMinutes,
      equipment: modesFromAccess(answers.equipment),
      lifestyle: { ...data.profile.lifestyle, training: { minDays: data.profile.lifestyle.training?.minDays ?? null, preferredDays: answers.preferredWeekdays } },
      trainingPrefs: { ...data.profile.trainingPrefs, equipmentAccess: answers.equipment, priorities: answers.priorities, avoidExerciseIds: answers.avoidExerciseIds, daysPerWeek: answers.daysPerWeek },
      updatedAt: now.toISOString(),
    });
    setSaved({ ...programme, isActive: activate });
    announce(activate ? `${programme.name} saved and set as your active programme.` : `${programme.name} saved. Your current programme is still active.`);
    go('saved');
  };

  return (
    <div className="screen">
      <ScreenHeader
        back={{ href: '#/library', label: 'Programmes' }}
        title={step === 'results' ? 'Recommended programmes' : step === 'customise' ? 'Preview and customise' : step === 'saved' ? 'Programme saved' : 'Recommend a programme'}
        subtitle={
          qIndex >= 0 ? (
            <span aria-live="polite">
              Question {qIndex + 1} of {QUESTIONS.length} · answers already in your profile are filled in
            </span>
          ) : undefined
        }
      />

      {step === 'goal' && (
        <section className="card">
          <RadioGroup legend="What's your primary fitness goal?" name="g-goal" layout="cards" choices={GOAL_CHOICES} value={answers.goal} onChange={(v) => set({ goal: v })} />
        </section>
      )}

      {step === 'experience' && (
        <section className="card">
          <RadioGroup legend="Training experience" name="g-exp" layout="cards" choices={EXPERIENCE_CHOICES} value={answers.experience} onChange={(v) => set({ experience: v })} description="Reused from your profile — change it if it's out of date." />
        </section>
      )}

      {step === 'availability' && (
        <section className="card">
          <RadioGroup
            legend="How many days can you realistically train each week?"
            name="g-days"
            choices={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
            value={answers.daysPerWeek}
            onChange={(v) => set({ daysPerWeek: v })}
          />
          <RadioGroup
            legend="How much time do you usually have per session?"
            name="g-min"
            choices={SESSION_LENGTHS.map((m) => ({ value: m, label: m === 90 ? '90+ min' : `${m} min` }))}
            value={answers.sessionMinutes}
            onChange={(v) => set({ sessionMinutes: v })}
          />
          <DayPicker legend="Preferred training days (optional)" value={answers.preferredWeekdays} onChange={(v) => set({ preferredWeekdays: v })} />
        </section>
      )}

      {step === 'equipment' && (
        <section className="card">
          <RadioGroup
            legend="What equipment do you have?"
            name="g-eq"
            layout="cards"
            choices={EQUIPMENT_ACCESS.map((e) => ({ value: e, label: EQUIPMENT_ACCESS_LABEL[e], hint: EQUIPMENT_HINT[e] }))}
            value={answers.equipment}
            onChange={(v) => set({ equipment: v })}
          />
        </section>
      )}

      {step === 'priorities' && (
        <section className="card">
          <CheckboxGroup
            legend="Training priorities (optional)"
            name="g-prio"
            description="Exercises for these areas are marked as priority, so they're kept first on short days."
            choices={MUSCLE_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            values={answers.priorities}
            onChange={(v) => set({ priorities: v })}
          />
          <details className="disclosure">
            <summary>Exercises to avoid (optional){answers.avoidExerciseIds.length ? ` · ${answers.avoidExerciseIds.length} selected` : ''}</summary>
            <CheckboxGroup
              legend="Don't include these exercises"
              name="g-avoid"
              description="Choose any you can't or prefer not to do. AdaptFit picks an alternative where one fits your equipment."
              choices={AVOIDABLE.map((e) => ({ value: e.id, label: e.name }))}
              values={answers.avoidExerciseIds}
              onChange={(v) => set({ avoidExerciseIds: v })}
            />
          </details>
        </section>
      )}

      {qIndex >= 0 && (
        <div className="row">
          <button type="button" className="btn btn-tertiary" onClick={() => (qIndex === 0 ? navigate('/library') : go(QUESTIONS[qIndex - 1]!))}>
            Back
          </button>
          <button type="button" className="btn btn-primary btn-grow btn-lg" onClick={() => go(qIndex === QUESTIONS.length - 1 ? 'results' : QUESTIONS[qIndex + 1]!)}>
            {qIndex === QUESTIONS.length - 1 ? 'See recommendations' : 'Next'}
          </button>
        </div>
      )}

      {step === 'results' && (
        <>
          <p className="small muted">
            Based on {answers.daysPerWeek} {plural(answers.daysPerWeek, 'day')} a week, {answers.sessionMinutes}-minute sessions, and {EQUIPMENT_ACCESS_LABEL[answers.equipment].toLowerCase()}. Ranked by fit — nothing changes until you save.
          </p>
          {data.activeProgramme && (
            <p className="xs muted" data-testid="keeps-existing">
              Your current programme ({data.activeProgramme.name}) stays as it is. A new programme is added alongside it.
            </p>
          )}
          <ol className="stack" data-testid="recommendations">
            {(compare ? results : results.filter((r) => !r.dayMismatch).slice(0, 3)).map((r, i) => (
              <RecommendationCard key={r.template.id} rec={r} rank={i + 1} onChoose={() => choose(r)} />
            ))}
          </ol>
          {results.every((r) => r.dayMismatch) && <p className="small amber">No template fits {answers.daysPerWeek} days a week exactly. The options below explain the mismatch.</p>}
          <div className="row wrap">
            <button type="button" className="btn btn-tertiary btn-grow" onClick={() => setCompare((v) => !v)} aria-pressed={compare}>
              {compare ? 'Show top matches' : `Compare all ${results.length} templates`}
            </button>
            <button type="button" className="btn btn-tertiary btn-grow" onClick={() => go('goal')}>
              Change answers
            </button>
          </div>
          {compare && <CompareTable results={results} />}
        </>
      )}

      {step === 'customise' && draft && chosen && (
        <>
          <section className="card">
            <div className="row between wrap">
              <h2 className="card-title">{draft.name}</h2>
              <span className="pill num">
                {draft.daysPerWeek}×/week · ~{Math.max(...draft.days.map((d) => estimateDayMinutes(d)))} min
              </span>
            </div>
            <p className="small muted">{chosen.template.summary}</p>
            <DayPicker legend="Training days" value={draft.preferredWeekdays} onChange={(v) => setDraft({ ...draft, preferredWeekdays: v })} />
            <p className="xs muted">
              <strong>Progression:</strong> {chosen.template.progression} <strong>Recovery:</strong> {chosen.template.recovery}
            </p>
          </section>
          {draft.days.map((day) => (
            <CustomiseDay
              key={day.id}
              day={day}
              options={options}
              unit={data.profile.weightUnit}
              onChange={(next) => setDraft({ ...draft, days: draft.days.map((d) => (d.id === next.id ? next : d)) })}
            />
          ))}
          <section className="card">
            <Switch
              label="Make this my active programme"
              hint={data.activeProgramme ? `If off, ${data.activeProgramme.name} stays active and this one is saved for later.` : 'Train will follow this programme.'}
              checked={activate}
              onChange={setActivate}
            />
            {errors.length > 0 && (
              <ul className="bullet-list error-list" role="alert">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={save}>
              Save as workout note
            </button>
            <button type="button" className="btn btn-tertiary btn-block" onClick={() => go('results')}>
              Back to recommendations
            </button>
            <p className="xs muted">You can edit everything later directly in the note. Past workouts are never changed.</p>
          </section>
        </>
      )}

      {step === 'saved' && saved && (
        <>
          <section className="status-banner" data-testid="programme-saved">
            <IconCheck />
            <div>
              <span className="strong">{saved.name} saved</span>
              <p className="small muted">{saved.isActive ? 'It’s now your current plan, written as a workout note.' : 'Saved as a workout note alongside your current plan.'}</p>
            </div>
          </section>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate(`/note/${encodeURIComponent(saved.id)}`)} data-testid="open-note">
            Open workout note
          </button>
          <p className="xs muted">Optional: calorie and protein targets are in Coach → Fuel whenever you want them.</p>
        </>
      )}
    </div>
  );
}

function RecommendationCard({ rec, rank, onChoose }: { rec: TemplateRecommendation; rank: number; onChoose: () => void }) {
  const t = rec.template;
  const max = Math.max(1, ...rec.distribution.map((d) => d.sets));
  return (
    <li className={`card ${rank === 1 && !rec.dayMismatch ? 'card-glow' : ''}`} data-testid="recommendation-card" data-template={t.id}>
      <div className="row between wrap">
        <span className="eyebrow">{rec.dayMismatch ? 'Doesn’t fit your days' : rank === 1 ? 'Best match' : `Option ${rank}`}</span>
        <span className="pill num">
          {t.daysPerWeek} {plural(t.daysPerWeek, 'day')}/week
        </span>
      </div>
      <h2 className="card-title">{t.name}</h2>
      <p className="xs muted">
        {t.audience} · <IconClock size={12} /> ~{rec.estimatedMinutes} min per session (incl. warm-up and rest)
        {rec.trimmed ? ' · shortened to fit' : ''}
      </p>
      <p className="small">{t.summary}</p>
      {rec.reasons.length > 0 && (
        <div className="stack-sm">
          <span className="section-label">Why it was recommended</span>
          <ul className="check-list small">
            {rec.reasons.map((r) => (
              <li key={r}>
                <IconCheck size={14} /> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {rec.tradeoffs.length > 0 && (
        <div className="stack-sm">
          <span className="section-label">Trade-offs</span>
          <ul className="bullet-list small">
            {rec.tradeoffs.map((r) => (
              <li key={r} className={rec.dayMismatch ? 'amber' : undefined}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="disclosure">
        <summary>Full routine and weekly distribution</summary>
        {rec.days.map((d) => (
          <div key={d.id} className="stack-sm mt-2">
            <span className="strong small">
              {d.name} <span className="muted num">· ~{estimateDayMinutes(d)} min</span>
            </span>
            <ul className="ex-preview">
              {d.exercises.map((e) => (
                <li key={e.id}>
                  <span>
                    {e.name} {e.priority && <span className="prio">★</span>}
                  </span>
                  <span className="muted num">
                    {e.sets} × {e.loadType === 'timed' ? `${e.durationSec}s` : repRange(e.repMin, e.repMax)} · rest {e.restSec}s
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <span className="section-label section-label-block mt-3">
          Expected working sets per week
        </span>
        <ul className="dist-list" aria-label="Expected weekly sets by muscle group">
          {rec.distribution.map((d) => (
            <li key={d.muscle}>
              <span className="xs">{d.label}</span>
              <span className="dist-bar" aria-hidden="true">
                <span style={{ width: `${(d.sets / max) * 100}%` }} />
              </span>
              <span className="xs num muted">{d.sets}</span>
            </li>
          ))}
        </ul>
        <p className="xs faint">
          Evidence: {t.sources.map((s) => SOURCES_BY_ID.get(s)?.short ?? s).join('; ')}. Equipment: {t.equipmentNote}
        </p>
      </details>
      <button type="button" className={`btn ${rec.dayMismatch ? 'btn-tertiary' : 'btn-primary'} btn-block`} onClick={onChoose}>
        Preview and customise
      </button>
    </li>
  );
}

function CompareTable({ results }: { results: TemplateRecommendation[] }) {
  return (
    <section className="card" aria-labelledby="compare-title">
      <h2 id="compare-title" className="card-title">
        Compare templates
      </h2>
      <div className="table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Template</th>
              <th scope="col">Days</th>
              <th scope="col">Session</th>
              <th scope="col">Fits you?</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.template.id}>
                <th scope="row">{r.template.name}</th>
                <td className="num">{r.template.daysPerWeek}</td>
                <td className="num">~{r.estimatedMinutes} min</td>
                <td>{r.dayMismatch ? 'Too many days' : !r.fitsTime ? 'Too long' : r.trimmed ? 'Shortened' : 'Yes'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomiseDay({ day, options, unit, onChange }: { day: ProgrammeDay; options: Record<string, string[]>; unit: 'kg' | 'lb'; onChange: (d: ProgrammeDay) => void }) {
  const setEx = (id: string, patch: Partial<ProgrammeExercise>) => onChange({ ...day, exercises: day.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  return (
    <details className="card day-card" open>
      <summary className="row between">
        <span>
          <span className="strong">{day.name}</span>
          <span className="xs muted num block">
            {day.exercises.length} exercises · ~{estimateDayMinutes(day)} min
          </span>
        </span>
      </summary>
      <div className="stack mt-3">
        {day.exercises.map((e) => {
          const alts = (options[e.id] ?? []).filter((id) => id !== e.exerciseId);
          return (
            <div key={e.id} className="pe-row" data-testid="guided-exercise">
              <div className="row between wrap">
                <span className="strong small">
                  {e.name} {e.priority && <span className="prio">★ priority</span>}
                </span>
                {alts.length > 0 && (
                  <label className="row xs">
                    <span className="muted">Swap</span>
                    <select className="select select-sm" value="" aria-label={`Swap ${e.name}`} onChange={(ev) => ev.target.value && onChange(swapExercise(day, e.id, ev.target.value))}>
                      <option value="">Choose…</option>
                      {alts.map((id) => (
                        <option key={id} value={id}>
                          {EXERCISES_BY_ID.get(id)?.name ?? id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="pe-grid">
                <SmallNum label="Sets" value={e.sets} onChange={(v) => setEx(e.id, { sets: v ?? 1 })} />
                {e.loadType === 'timed' ? (
                  <SmallNum label="Seconds" value={e.durationSec} onChange={(v) => setEx(e.id, { durationSec: v })} />
                ) : (
                  <>
                    <SmallNum label="Min reps" value={e.repMin} onChange={(v) => setEx(e.id, { repMin: v })} />
                    <SmallNum label="Max reps" value={e.repMax} onChange={(v) => setEx(e.id, { repMax: v })} />
                  </>
                )}
                <SmallNum label="Rest (s)" value={e.restSec} onChange={(v) => setEx(e.id, { restSec: v ?? 0 })} />
              </div>
              <PlannedLoadField loadType={e.loadType} value={e.plannedLoad} defaultUnit={unit} exerciseName={e.name} onChange={(v) => setEx(e.id, { plannedLoad: v })} />
            </div>
          );
        })}
        <p className="xs muted row">
          <IconInfo size={14} /> Estimates include a 5-minute warm-up, rest periods, and changeovers.
        </p>
      </div>
    </details>
  );
}

function SmallNum({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="field">
      <span className="field-label xs">{label}</span>
      <input
        className="input input-num"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (t === '') return onChange(null);
          if (/^\d+$/.test(t)) onChange(Number(t));
        }}
      />
    </label>
  );
}
