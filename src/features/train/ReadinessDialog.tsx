import { useId, useState } from 'react';
import { saveCheckIn } from '../../data/repo';
import type { CheckIn, EquipmentMode, Level3, Profile, SafetyConcern } from '../../domain/types';
import { useAnnounce } from '../../ui/Announcer';
import { RadioGroup } from '../../ui/ChoiceGroup';
import { clock } from '../../ui/clock';
import { Dialog } from '../../ui/Dialog';

const LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;
const OPTIONAL_LEVELS = [{ value: 'skip', label: 'Skip' }, ...LEVELS] as const;
const SAFETY = [
  { value: 'none', label: 'No — I feel OK' },
  { value: 'pain', label: 'Pain or possible injury' },
  { value: 'illness', label: 'Feeling ill' },
  { value: 'unsafe', label: 'Something feels unsafe' },
] as const;

/**
 * Optional daily readiness. Time available can shorten today's session (with
 * approval); a safety concern gives a rest day. Sleep/fatigue/stress are
 * optional and never required.
 */
export function ReadinessDialog({ profile, today, existing, onClose }: { profile: Profile; today: string; existing: CheckIn | undefined; onClose: () => void }) {
  const [minutes, setMinutes] = useState(String(existing?.availableMinutes ?? profile.preferredMinutes));
  const [energy, setEnergy] = useState<Level3>(existing?.energy ?? 'medium');
  const [soreness, setSoreness] = useState<'none' | 'mild' | 'high'>(existing?.soreness ?? 'none');
  const [sleep, setSleep] = useState(existing?.sleepHours != null ? String(existing.sleepHours) : '');
  const [fatigue, setFatigue] = useState<Level3 | 'skip'>(existing?.fatigue ?? 'skip');
  const [stress, setStress] = useState<Level3 | 'skip'>(existing?.stress ?? 'skip');
  const [safety, setSafety] = useState<SafetyConcern | 'none'>(existing?.safetyConcern ?? 'none');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const minutesId = useId();
  const sleepId = useId();
  const announce = useAnnounce();

  const save = async () => {
    const m = minutes.trim();
    if (!/^\d+$/.test(m) || Number(m) > 240) return setError('Enter your available time as whole minutes (0–240).');
    const s = sleep.trim().replace(',', '.');
    if (s && (!/^\d+(\.\d)?$/.test(s) || Number(s) > 24)) return setError('Sleep must be hours between 0 and 24 (e.g. 6.5), or left blank.');
    setBusy(true);
    try {
      await saveCheckIn({
        localDate: today,
        availableMinutes: Number(m),
        energy,
        soreness,
        equipment: (existing?.equipment ?? profile.equipment) as EquipmentMode[],
        safetyConcern: safety === 'none' ? null : safety,
        sleepHours: s ? Number(s) : null,
        sleepQuality: existing?.sleepQuality ?? null,
        fatigue: fatigue === 'skip' ? null : fatigue,
        stress: stress === 'skip' ? null : stress,
        updatedAt: clock.now().toISOString(),
      });
      announce(safety !== 'none' ? 'Check-in saved. Today is a rest day.' : 'Check-in saved.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Adjust for today"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-tertiary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <p className="small muted">Optional. AdaptFit keeps your planned session unless you approve a change.</p>
      <div className="field">
        <label className="field-label" htmlFor={minutesId}>
          Time available today (minutes)
        </label>
        <input id={minutesId} className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      </div>
      <RadioGroup legend="Energy" name="ready-energy" choices={LEVELS} value={energy} onChange={setEnergy} />
      <RadioGroup
        legend="Ordinary muscle soreness"
        name="ready-soreness"
        choices={[
          { value: 'none', label: 'None' },
          { value: 'mild', label: 'Mild' },
          { value: 'high', label: 'High' },
        ]}
        value={soreness}
        onChange={setSoreness}
      />
      <div className="field">
        <label className="field-label" htmlFor={sleepId}>
          Sleep last night (hours, optional)
        </label>
        <input id={sleepId} className="input" inputMode="decimal" placeholder="e.g. 7" value={sleep} onChange={(e) => setSleep(e.target.value)} />
      </div>
      <RadioGroup legend="Fatigue (optional)" name="ready-fatigue" choices={OPTIONAL_LEVELS} value={fatigue} onChange={setFatigue} />
      <RadioGroup legend="Stress (optional)" name="ready-stress" choices={OPTIONAL_LEVELS} value={stress} onChange={setStress} />
      <RadioGroup
        legend="Any reason you shouldn't train today?"
        name="ready-safety"
        layout="cards"
        description="Separate from ordinary soreness. Any concern gives you a rest day."
        choices={SAFETY}
        value={safety}
        onChange={setSafety}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
