import { useId, useMemo, useState } from 'react';
import { newId, saveProfile, saveProgramme } from '../../data/repo';
import { deviceTimeZone } from '../../domain/migrate';
import { parseRoutine } from '../../domain/notesImport';
import { createProgramme, programmeExercise } from '../../domain/programme';
import { DEFAULT_CHARACTER, DIETARY_OPTIONS, EMPTY_LIFESTYLE, EMPTY_TRAINING_PREFS, type Experience, type Lifestyle, type Programme, type TrainingGoal, type WeightUnit } from '../../domain/types';
import { Adventurer } from '../../ui/Adventurer';
import { useAnnounce } from '../../ui/Announcer';
import { RadioGroup } from '../../ui/ChoiceGroup';
import { clock } from '../../ui/clock';
import { DayPicker, Switch } from '../../ui/controls';
import { navigate } from '../../ui/hooks';
import { Logo } from '../../ui/icons';
import { CharacterPicker } from '../journey/CharacterPicker';
import { RestoreBackup } from '../settings/RestoreBackup';
import { EXPERIENCE_CHOICES, GOAL_CHOICES } from './choices';

type Step = 'welcome' | 'goal' | 'routine' | 'schedule' | 'lifestyle' | 'character';
const STEPS: Step[] = ['welcome', 'goal', 'routine', 'schedule', 'lifestyle', 'character'];
type RoutineChoice = 'recommend' | 'paste' | 'create' | 'skip';

export function Onboarding() {
  const announce = useAnnounce();
  const [step, setStep] = useState<Step>('welcome');
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [experience, setExperience] = useState<Experience>('intermediate');
  const [routine, setRoutine] = useState<RoutineChoice>('recommend');
  const [character, setCharacter] = useState<string>(DEFAULT_CHARACTER.style);
  const [routineText, setRoutineText] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 4, 5]);
  const [minutes, setMinutes] = useState(60);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [timezone, setTimezone] = useState(() => deviceTimeZone());
  const [workDays, setWorkDays] = useState<number[]>([]);
  const [workStart, setWorkStart] = useState('');
  const [workEnd, setWorkEnd] = useState('');
  const [bedtime, setBedtime] = useState('');
  const [wake, setWake] = useState('');
  const [diet, setDiet] = useState<string[]>([]);
  const [gamification, setGamification] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { rt: useId(), ws: useId(), we: useId(), bt: useId(), wk: useId(), tz: useId() };
  const parsed = useMemo(() => parseRoutine(routineText), [routineText]);

  const idx = STEPS.indexOf(step);
  const next = () => {
    setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]!);
    window.scrollTo({ top: 0 });
  };
  const back = () => setStep(STEPS[Math.max(0, idx - 1)]!);

  const finish = async () => {
    setBusy(true);
    setError(null);
    const now = clock.now();
    const iso = now.toISOString();
    const lifestyle: Lifestyle = {
      ...EMPTY_LIFESTYLE,
      work: workDays.length || workStart || workEnd ? { days: workDays, start: workStart || null, end: workEnd || null, overtime: null, trainingWindows: [] } : null,
      sleep: bedtime || wake ? { bedtime: bedtime || null, wake: wake || null, quality: null } : null,
      nutrition: diet.length ? { pattern: '', objective: null, restrictions: diet, proteinTargetG: null, energyKcal: null, fasting: null } : null,
      training: { minDays: null, preferredDays: weekdays },
    };
    let programme: Programme | null = null;
    if (routine === 'create') programme = createProgramme(newId, now, { name: 'My programme', goal, days: [{ id: newId(), name: 'Day 1', exercises: [] }], daysPerWeek, preferredWeekdays: weekdays });
    else if (routine === 'paste' && parsed.days.length) {
      programme = createProgramme(newId, now, {
        name: 'My programme',
        goal,
        daysPerWeek,
        preferredWeekdays: weekdays,
        source: 'imported',
        days: parsed.days.map((d) => ({
          id: newId(),
          name: d.name,
          exercises: d.lines.map((l) => programmeExercise(newId, { exerciseId: l.exerciseId ?? '', name: l.name, loadType: l.loadType ?? (l.exerciseId ? undefined : 'unspecified'), sets: l.sets, repMin: l.repMin, repMax: l.repMax, durationSec: l.durationSec })),
        })),
      });
    }
    try {
      if (programme) await saveProgramme(programme, { activate: true });
      await saveProfile({
        id: 'me',
        goal,
        experience,
        equipment: ['bodyweight', 'gym'],
        preferredMinutes: minutes,
        weightUnit: unit,
        timezone,
        gamification,
        lifestyle,
        character: { ...DEFAULT_CHARACTER, style: character, updatedAt: iso },
        trainingPrefs: { ...structuredClone(EMPTY_TRAINING_PREFS), daysPerWeek },
        createdAt: iso,
        updatedAt: iso,
      });
      announce('Setup complete. Welcome to AdaptFit.');
      const needsEditing = programme && (routine === 'create' || programme.days.some((d) => d.exercises.some((e) => !e.exerciseId)));
      navigate(routine === 'recommend' ? '/programmes/guide' : needsEditing ? `/programmes/${programme!.id}` : '/train');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your setup.');
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <main id="main" className="main main-narrow">
        <div className="stack">
          <div className="row between">
            <span className="brand">
              <Logo /> Adapt<span className="brand-fit">Fit</span>
            </span>
            {step !== 'welcome' && (
              <span className="xs muted num" aria-label={`Step ${idx} of ${STEPS.length - 1}`}>
                {idx} / {STEPS.length - 1}
              </span>
            )}
          </div>

          {step === 'welcome' && (
            <>
              <section className="scene">
                <div className="scene-frame" style={{ width: 120, height: 120 }}>
                  <Adventurer level={1} size={104} label="Your AdaptFit adventurer" />
                </div>
                <div className="stack-sm">
                  <h1 tabIndex={-1}>Welcome to AdaptFit</h1>
                  <p className="small muted">Your training partner for real life.</p>
                </div>
              </section>
              <section className="card">
                <ul className="check-list small">
                  <li>✓ Keeps your own gym programme — never swaps it for a generic workout.</li>
                  <li>✓ Logging in a tap: last session's weights and reps are prefilled.</li>
                  <li>✓ Honest progress, plateau checks, and schedule help for busy weeks.</li>
                  <li>✓ A pixel adventurer that levels up with real progress.</li>
                  <li>✓ Private by design: everything stays on this device.</li>
                </ul>
                <button type="button" className="btn btn-primary btn-lg btn-block" onClick={next}>
                  Get started
                </button>
              </section>
              <section className="card">
                <h2 className="card-title">Coming back?</h2>
                <p className="small muted">Restore an AdaptFit backup (V0.1, V0.2, or V0.3) to bring back your history.</p>
                <RestoreBackup hasExistingData={false} />
              </section>
            </>
          )}

          {step === 'goal' && (
            <section className="card">
              <h1 tabIndex={-1}>Your goal</h1>
              <RadioGroup legend="Main goal" name="ob-goal" layout="cards" choices={GOAL_CHOICES} value={goal} onChange={setGoal} />
              <RadioGroup legend="Training experience" name="ob-exp" layout="cards" choices={EXPERIENCE_CHOICES} value={experience} onChange={setExperience} />
            </section>
          )}

          {step === 'routine' && (
            <section className="card">
              <h1 tabIndex={-1}>Your training programme</h1>
              <p className="small muted">AdaptFit follows the programme you choose — it never swaps it for a generic workout.</p>
              <RadioGroup
                legend="How do you want to start?"
                name="ob-routine"
                layout="cards"
                value={routine}
                onChange={setRoutine}
                choices={[
                  { value: 'recommend', label: 'Recommend a programme', hint: 'A few quick questions after setup, then preview and customise' },
                  { value: 'paste', label: 'Use my existing programme', hint: 'Paste it from your notes app' },
                  { value: 'create', label: 'Build from scratch', hint: 'Opens the programme editor' },
                  { value: 'skip', label: 'Skip for now', hint: 'Set it up later in Settings' },
                ]}
              />
              {routine === 'paste' && (
                <div className="field">
                  <label className="field-label" htmlFor={ids.rt}>
                    Paste your routine
                  </label>
                  <textarea id={ids.rt} className="textarea" value={routineText} onChange={(e) => setRoutineText(e.target.value)} placeholder={'Upper Body A\nSmith bench 3x6-10\nLat pulldown 3x8-12\n\nLower Body A\nSmith squat 3x6-10\nLeg curl 3x10-15'} />
                  <p className="field-hint">
                    {parsed.days.length
                      ? `Found ${parsed.days.length} day${parsed.days.length === 1 ? '' : 's'} and ${parsed.days.reduce((n, d) => n + d.lines.length, 0)} exercises. You'll review unknown names next.`
                      : 'One heading per day, then lines like “Lat pulldown 3x8-12”.'}
                  </p>
                </div>
              )}
              {routine === 'recommend' && <p className="xs muted">Your answers here (goal, experience, schedule) are reused — you won't be asked twice.</p>}
            </section>
          )}

          {step === 'schedule' && (
            <section className="card">
              <h1 tabIndex={-1}>Your schedule</h1>
              <RadioGroup legend="Sessions per week" name="ob-days" choices={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} value={daysPerWeek} onChange={setDaysPerWeek} />
              <DayPicker legend="Preferred gym days" value={weekdays} onChange={setWeekdays} />
              <RadioGroup legend="Usual session length" name="ob-len" choices={[30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} min` }))} value={minutes} onChange={setMinutes} />
              <RadioGroup
                legend="Weight unit"
                name="ob-unit"
                choices={[
                  { value: 'kg', label: 'Kilograms (kg)' },
                  { value: 'lb', label: 'Pounds (lb)' },
                ]}
                value={unit}
                onChange={setUnit}
              />
            </section>
          )}

          {step === 'lifestyle' && (
            <section className="card">
              <h1 tabIndex={-1}>Lifestyle (optional)</h1>
              <p className="small muted">Helps adapt busy weeks. Skip anything — you can add it later in Settings.</p>
              <DayPicker legend="Working days" value={workDays} onChange={setWorkDays} />
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor={ids.ws}>
                    Work starts
                  </label>
                  <input id={ids.ws} type="time" className="input" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor={ids.we}>
                    Work ends
                  </label>
                  <input id={ids.we} type="time" className="input" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor={ids.bt}>
                    Usual bedtime
                  </label>
                  <input id={ids.bt} type="time" className="input" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor={ids.wk}>
                    Usual wake time
                  </label>
                  <input id={ids.wk} type="time" className="input" value={wake} onChange={(e) => setWake(e.target.value)} />
                </div>
              </div>
              <fieldset className="field">
                <legend className="field-label">Dietary preferences</legend>
                <div className="choices choices-chips">
                  {DIETARY_OPTIONS.map((d) => (
                    <label key={d} className="choice">
                      <input type="checkbox" checked={diet.includes(d)} onChange={(e) => setDiet(e.target.checked ? [...diet, d] : diet.filter((x) => x !== d))} />
                      <span className="choice-body">
                        <span className="choice-label">{d === 'no-pork' ? 'No pork' : d === 'no-beef' ? 'No beef' : d.charAt(0).toUpperCase() + d.slice(1)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label className="field-label" htmlFor={ids.tz}>
                  Time zone
                </label>
                <select id={ids.tz} className="select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {[...new Set([timezone, 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'UTC'])].map((z) => (
                    <option key={z} value={z}>
                      {z.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          )}

          {step === 'character' && (
            <section className="card">
              <h1 tabIndex={-1}>Meet your adventurer</h1>
              <CharacterPicker value={character} level={1} onChange={setCharacter} name="ob-character" />
              <div className="scene">
                <div className="scene-frame" style={{ width: 120, height: 120 }}>
                  <Adventurer styleId={character} level={1} size={104} decorative />
                </div>
                <div className="stack-sm small">
                  <span>
                    <span className="stat-str strong">STR</span> grows with personal records.
                  </span>
                  <span>
                    <span className="stat-end strong">END</span> with full-volume sessions.
                  </span>
                  <span>
                    <span className="stat-rec strong">REC</span> with recovery check-ins.
                  </span>
                  <span>
                    <span className="stat-cons strong">CONS</span> with planned weeks completed.
                  </span>
                </div>
              </div>
              <p className="xs muted">Earn XP for planned workouts and real progress. Missed sessions are never penalised. These are game stats, not fitness measurements.</p>
              <Switch label="Show character, XP, and missions" hint="You can change this later. Workout features are identical either way." checked={gamification} onChange={setGamification} />
            </section>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {step !== 'welcome' && (
            <div className="row">
              <button type="button" className="btn btn-tertiary" onClick={back}>
                Back
              </button>
              {step === 'character' ? (
                <button type="button" className="btn btn-primary btn-grow btn-lg" onClick={finish} disabled={busy}>
                  {routine === 'recommend' ? 'Continue to programme questions' : 'Start training'}
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-grow btn-lg" onClick={next}>
                  {step === 'lifestyle' ? 'Continue' : 'Next'}
                </button>
              )}
            </div>
          )}
          <p className="xs faint">AdaptFit offers general fitness guidance for adults. It does not diagnose, give medical clearance, or replace a qualified professional.</p>
        </div>
      </main>
    </div>
  );
}
