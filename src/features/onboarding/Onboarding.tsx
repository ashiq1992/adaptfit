import { useState } from 'react';
import { newId, saveNote, saveProfile } from '../../data/repo';
import { deviceTimeZone } from '../../domain/migrate';
import { createProgramme } from '../../domain/programme';
import { DEFAULT_CHARACTER, DEFAULT_NOTIFICATIONS, EMPTY_LIFESTYLE, EMPTY_TRAINING_PREFS, type Profile, type TrainingGoal, type WeightUnit } from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { navigate } from '../../ui/hooks';
import { Logo, Wordmark } from '../../ui/icons';
import { RestoreBackup } from '../settings/RestoreBackup';
import { GOAL_CHOICES } from './choices';

type Start = 'paste' | 'library' | 'write' | 'skip';

/**
 * First run, kept short: units and (optionally) a goal, then how to start the
 * workout note. Everything else is asked only when a feature needs it.
 */
export function Onboarding() {
  const announce = useAnnounce();
  const [step, setStep] = useState<'welcome' | 'start'>('welcome');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (start: Start) => {
    setBusy(true);
    setError(null);
    const now = clock.now();
    const iso = now.toISOString();
    const profile: Profile = {
      id: 'me',
      goal,
      experience: 'intermediate',
      equipment: ['gym'],
      preferredMinutes: 60,
      weightUnit: unit,
      timezone: deviceTimeZone(),
      gamification: false,
      lifestyle: structuredClone(EMPTY_LIFESTYLE),
      character: structuredClone(DEFAULT_CHARACTER),
      trainingPrefs: structuredClone(EMPTY_TRAINING_PREFS),
      loggingMode: 'weekly',
      notifications: { ...DEFAULT_NOTIFICATIONS },
      createdAt: iso,
      updatedAt: iso,
    };
    try {
      if (start === 'write') {
        const p = createProgramme(newId, now, { name: 'My training plan', goal, days: [{ id: newId(), name: 'Day 1', exercises: [], notes: '' }], daysPerWeek: 3, source: 'created' });
        await saveNote(p, 'Created', now, { activate: true });
        await saveProfile(profile);
        navigate(`/note/${encodeURIComponent(p.id)}/${encodeURIComponent(p.days[0]!.id)}?edit=text`);
      } else {
        await saveProfile(profile);
        navigate(start === 'paste' ? '/import' : start === 'library' ? '/library' : '/plan');
      }
      announce('Welcome to AdaptFit.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your setup.');
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <main id="main" className="main main-narrow">
        <div className="stack onboarding">
          <span className="row" aria-hidden="true">
            <Logo size={34} />
            <Wordmark className="wordmark-lg" />
          </span>
          {step === 'welcome' ? (
            <>
              <div className="stack-sm">
                <h1 tabIndex={-1}>Welcome to AdaptFit</h1>
                <p className="lead">Write it down. Watch it add up.</p>
              </div>
              <ul className="check-list small">
                <li>Your workout reads like a note — no need to start a workout or log every set.</li>
                <li>Once a week, change only what was different. AdaptFit keeps the history.</li>
                <li>Progress and coaching come from your own confirmed records, and stay on this device.</li>
              </ul>
              <fieldset className="field">
                <legend className="field-label">Weights in</legend>
                <div className="seg" role="radiogroup" aria-label="Weight unit">
                  {(['kg', 'lb'] as const).map((u) => (
                    <button key={u} type="button" role="radio" aria-checked={unit === u} className="seg-btn" onClick={() => setUnit(u)}>
                      {u}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="field">
                <span className="field-label">Main goal</span>
                <select className="select" value={goal} onChange={(e) => setGoal(e.target.value as TrainingGoal)}>
                  {GOAL_CHOICES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setStep('start')}>
                Get started
              </button>
              <details className="card disclosure">
                <summary>Coming back? Restore a backup</summary>
                <p className="small muted">Backups from any AdaptFit version (V0.1–V0.4) can be restored.</p>
                <RestoreBackup hasExistingData={false} />
              </details>
            </>
          ) : (
            <>
              <h1 tabIndex={-1}>How do you want to start?</h1>
              <div className="stack-sm">
                <button type="button" className="option-card" disabled={busy} onClick={() => void finish('paste')}>
                  <span className="strong">Paste from Notes</span>
                  <span className="small muted">Already keep your workouts in Notes? Paste them and check how they were read.</span>
                </button>
                <button type="button" className="option-card" disabled={busy} onClick={() => void finish('library')}>
                  <span className="strong">Choose a programme</span>
                  <span className="small muted">Pick a starter routine, or answer five questions for a recommendation.</span>
                </button>
                <button type="button" className="option-card" disabled={busy} onClick={() => void finish('write')}>
                  <span className="strong">Write my own</span>
                  <span className="small muted">Start with a blank note and type your routine.</span>
                </button>
              </div>
              <button type="button" className="link-btn" disabled={busy} onClick={() => void finish('skip')}>
                Skip for now
              </button>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
