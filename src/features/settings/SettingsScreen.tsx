import { type ReactNode, useId, useState } from 'react';
import { deleteProgramme, newId, resetAllData, saveNutrition, saveProfile, saveProgramme } from '../../data/repo';
import { emptyNutritionProfile, seedFromLifestyle } from '../../domain/nutrition';
import { starterUpperLower, validateProgramme } from '../../domain/programme';
import { type Lifestyle, type Profile, TRAINING_WINDOWS, type TrainingWindow } from '../../domain/types';
import { usePwa } from '../../pwa';
import { useAnnounce } from '../../ui/Announcer';
import { RadioGroup } from '../../ui/ChoiceGroup';
import { clock } from '../../ui/clock';
import { DayPicker, SettingsGroup, Switch } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { ConfirmDialog } from '../../ui/Dialog';
import { navigate } from '../../ui/hooks';
import { IconBriefcase, IconCalendar, IconDatabase, IconGame, IconInfo, IconMoon, IconScroll, IconShield, IconTrain, IconUser, IconUtensils } from '../../ui/icons';
import { EXPERIENCE_CHOICES, GOAL_CHOICES } from '../onboarding/choices';
import { loadBackup, RestoreBackup } from './RestoreBackup';

type Status = { tone: 'ok' | 'error'; text: string } | null;

function useProfileSaver() {
  const { data } = useApp();
  const announce = useAnnounce();
  const [status, setStatus] = useState<Status>(null);
  const save = async (patch: Partial<Profile>, message = 'Saved.') => {
    try {
      await saveProfile({ ...data.profile, ...patch, updatedAt: clock.now().toISOString() });
      setStatus({ tone: 'ok', text: message });
      announce(message);
    } catch (err) {
      setStatus({ tone: 'error', text: err instanceof Error ? err.message : 'Could not save.' });
    }
  };
  return { profile: data.profile, save, status };
}

function StatusLine({ status, testId }: { status: Status; testId?: string }) {
  if (!status) return null;
  return (
    <p className={status.tone === 'ok' ? 'success' : 'error'} role={status.tone === 'ok' ? 'status' : 'alert'} data-testid={testId}>
      {status.text}
    </p>
  );
}

export function SettingsScreen() {
  return (
    <div className="screen">
      <div className="screen-head">
        <h1 tabIndex={-1}>Settings</h1>
      </div>
      <div className="grid-2">
        <div className="stack">
          <GoalsSection />
          <ProgrammesSection />
          <AvailabilitySection />
          <WorkSection />
          <SleepSection />
          <NutritionSection />
        </div>
        <div className="stack">
          <UnitsSection />
          <GamificationSection />
          <DataSection />
          <PrivacySection />
        </div>
      </div>
    </div>
  );
}

function GoalsSection() {
  const { profile, save, status } = useProfileSaver();
  return (
    <SettingsGroup icon={<IconUser />} title="Training goals" subtitle={`${GOAL_CHOICES.find((g) => g.value === profile.goal)?.label ?? profile.goal} · ${profile.experience}`}>
      <RadioGroup legend="Main goal" name="s-goal" layout="cards" choices={GOAL_CHOICES} value={profile.goal} onChange={(v) => void save({ goal: v }, 'Goal saved.')} />
      <RadioGroup legend="Training experience" name="s-exp" choices={EXPERIENCE_CHOICES} value={profile.experience} onChange={(v) => void save({ experience: v }, 'Experience saved.')} />
      <StatusLine status={status} testId="goals-status" />
    </SettingsGroup>
  );
}

function ProgrammesSection() {
  const { data } = useApp();
  const announce = useAnnounce();
  const [confirm, setConfirm] = useState<string | null>(null);
  const target = data.programmes.find((p) => p.id === confirm);
  return (
    <SettingsGroup icon={<IconScroll />} title="Training programmes" subtitle={data.activeProgramme ? `Active: ${data.activeProgramme.name}` : 'No programme yet'} id="programmes">
      {data.programmes.length === 0 && <p className="small muted">Create your own programme, start from an example, or import a routine.</p>}
      <ul className="stack-sm">
        {data.programmes.map((p) => {
          const issues = validateProgramme(p).length;
          return (
            <li key={p.id} className="pe-row">
              <div className="row between wrap">
                <span className="strong">{p.name}</span>
                {p.isActive ? <span className="pill pill-completed">Active</span> : null}
              </div>
              <span className="xs muted">
                {p.days.length} days · {p.daysPerWeek}× per week{p.source === 'starter' ? ' · from example' : ''}
                {issues ? ` · ${issues} item${issues === 1 ? '' : 's'} to fix` : ''}
              </span>
              <div className="row wrap">
                <a href={`#/programmes/${p.id}`} className="btn btn-tertiary btn-sm">
                  Edit
                </a>
                {!p.isActive && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={async () => {
                      await saveProgramme(p, { activate: true });
                      announce(`${p.name} is now active.`);
                    }}
                  >
                    Make active
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const now = clock.now().toISOString();
                    await saveProgramme({ ...structuredClone(p), id: newId(), name: `${p.name} (copy)`, isActive: false, createdAt: now, updatedAt: now });
                    announce('Programme duplicated.');
                  }}
                >
                  Duplicate
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(p.id)}>
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="row wrap">
        <a href="#/programmes/guide" className="btn btn-primary btn-grow">
          Recommend a programme
        </a>
        <a href="#/programmes/new" className="btn btn-secondary btn-grow">
          Build from scratch
        </a>
        <button
          type="button"
          className="btn btn-tertiary btn-grow"
          onClick={async () => {
            const p = starterUpperLower(newId, clock.now(), data.profile.goal);
            await saveProgramme(p, { activate: !data.activeProgramme });
            navigate(`/programmes/${p.id}`);
          }}
        >
          Add example
        </button>
      </div>
      {target && (
        <ConfirmDialog
          title={`Delete ${target.name}?`}
          confirmLabel="Delete programme"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await deleteProgramme(target.id);
            setConfirm(null);
            announce('Programme deleted. Workout history is unchanged.');
          }}
        >
          <p>Your workout history is kept — past sessions store their own copy of what you did.</p>
        </ConfirmDialog>
      )}
    </SettingsGroup>
  );
}

function AvailabilitySection() {
  const { profile, save, status } = useProfileSaver();
  const { data } = useApp();
  const t = profile.lifestyle.training ?? { minDays: null, preferredDays: [] };
  const setTraining = (patch: Partial<NonNullable<Lifestyle['training']>>) => save({ lifestyle: { ...profile.lifestyle, training: { ...t, ...patch } } }, 'Availability saved.');
  return (
    <SettingsGroup icon={<IconCalendar />} title="Training availability" subtitle={`${data.activeProgramme?.daysPerWeek ?? '—'} days/week · ${profile.preferredMinutes} min sessions`}>
      <RadioGroup
        legend="Preferred session length"
        name="s-len"
        choices={[30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} min` }))}
        value={profile.preferredMinutes}
        onChange={(v) => void save({ preferredMinutes: v }, 'Session length saved.')}
      />
      <DayPicker legend="Preferred gym days" value={t.preferredDays} onChange={(v) => void setTraining({ preferredDays: v })} />
      <RadioGroup
        legend="Minimum sessions in a busy week"
        name="s-min"
        choices={[{ value: 0, label: 'Not set' }, ...[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))]}
        value={t.minDays ?? 0}
        onChange={(v) => void setTraining({ minDays: v === 0 ? null : v })}
      />
      <p className="xs muted">Programme days per week are set in the programme editor.</p>
      <StatusLine status={status} />
    </SettingsGroup>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} type="time" className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    </div>
  );
}

function WorkSection() {
  const { profile, save, status } = useProfileSaver();
  const w = profile.lifestyle.work ?? { days: [], start: null, end: null, overtime: null, trainingWindows: [] };
  const set = (patch: Partial<NonNullable<Lifestyle['work']>>) => save({ lifestyle: { ...profile.lifestyle, work: { ...w, ...patch } } }, 'Work schedule saved.');
  return (
    <SettingsGroup icon={<IconBriefcase />} title="Work schedule" subtitle={profile.lifestyle.work ? `${w.days.length} work days${w.start ? ` · ${w.start}–${w.end ?? '?'}` : ''}` : 'Optional'}>
      <DayPicker legend="Typical working days" value={w.days} onChange={(v) => void set({ days: v })} />
      <div className="form-grid">
        <TimeField label="Usual start" value={w.start} onChange={(v) => void set({ start: v })} />
        <TimeField label="Usual finish" value={w.end} onChange={(v) => void set({ end: v })} />
      </div>
      <RadioGroup
        legend="Unusual overtime"
        name="s-ot"
        choices={[
          { value: 'none', label: 'Not set' },
          { value: 'rare', label: 'Rare' },
          { value: 'sometimes', label: 'Sometimes' },
          { value: 'often', label: 'Often' },
        ]}
        value={w.overtime ?? 'none'}
        onChange={(v) => void set({ overtime: v === 'none' ? null : v })}
      />
      <fieldset className="field">
        <legend className="field-label">Training windows that usually work</legend>
        <div className="choices choices-chips">
          {TRAINING_WINDOWS.map((tw) => (
            <label key={tw} className="choice">
              <input type="checkbox" checked={w.trainingWindows.includes(tw)} onChange={(e) => void set({ trainingWindows: e.target.checked ? [...w.trainingWindows, tw] : w.trainingWindows.filter((x: TrainingWindow) => x !== tw) })} />
              <span className="choice-body">
                <span className="choice-label">{tw === 'early' ? 'Early morning' : tw === 'late' ? 'Late night' : tw.charAt(0).toUpperCase() + tw.slice(1)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {profile.lifestyle.work && (
        <button type="button" className="link-btn" onClick={() => void save({ lifestyle: { ...profile.lifestyle, work: null } }, 'Work schedule cleared.')}>
          Clear work schedule
        </button>
      )}
      <StatusLine status={status} testId="work-status" />
    </SettingsGroup>
  );
}

function SleepSection() {
  const { profile, save, status } = useProfileSaver();
  const s = profile.lifestyle.sleep ?? { bedtime: null, wake: null, quality: null };
  const set = (patch: Partial<NonNullable<Lifestyle['sleep']>>) => save({ lifestyle: { ...profile.lifestyle, sleep: { ...s, ...patch } } }, 'Sleep habits saved.');
  return (
    <SettingsGroup icon={<IconMoon />} title="Sleep habits" subtitle={profile.lifestyle.sleep ? `${s.bedtime ?? '?'} – ${s.wake ?? '?'}` : 'Optional'}>
      <div className="form-grid">
        <TimeField label="Usual bedtime" value={s.bedtime} onChange={(v) => void set({ bedtime: v })} />
        <TimeField label="Usual wake time" value={s.wake} onChange={(v) => void set({ wake: v })} />
      </div>
      <RadioGroup
        legend="Usual sleep quality"
        name="s-sq"
        choices={[
          { value: 'none', label: 'Not set' },
          { value: 'poor', label: 'Poor' },
          { value: 'fair', label: 'Fair' },
          { value: 'good', label: 'Good' },
        ]}
        value={s.quality ?? 'none'}
        onChange={(v) => void set({ quality: v === 'none' ? null : v })}
      />
      <p className="xs muted">Recent sleep can be added in a daily check-in. It's never required.</p>
      <StatusLine status={status} />
    </SettingsGroup>
  );
}

function NutritionSection() {
  const { data } = useApp();
  const announce = useAnnounce();
  const n = data.nutrition;
  const old = data.profile.lifestyle.nutrition;
  const status = !n || n.status === 'not-asked' ? 'Not set up' : n.status === 'declined' ? 'Not now' : n.status === 'in-progress' ? `Setup in progress (step ${n.step + 1})` : 'Set up';
  const start = async () => {
    const now = clock.now();
    const base = seedFromLifestyle(n ?? emptyNutritionProfile(now), data.profile.lifestyle);
    await saveNutrition({ ...base, status: base.status === 'complete' ? 'complete' : 'in-progress', updatedAt: now.toISOString() });
    announce('Opening AdaptFit Fuel.');
    navigate('/coach/fuel');
  };
  return (
    <SettingsGroup icon={<IconUtensils />} title="Nutrition preferences (AdaptFit Fuel)" subtitle={status} id="nutrition">
      <p className="small muted">Optional calorie and protein estimates, eating habits, cuisines, dietary requirements, and Singapore meal ideas. Nothing here is needed to train.</p>
      {n?.status === 'complete' && (
        <ul className="bullet-list small" data-testid="settings-fuel-summary">
          <li>Calories: {n.target?.kcal ? `${n.target.kcal} kcal` : 'not set'}; protein: {n.target?.proteinG ? `${n.target.proteinG[0]}–${n.target.proteinG[1]} g` : 'not set'}</li>
          <li>Meals: {n.habits.source === 'home' ? 'mostly home-cooked' : n.habits.source === 'out' ? 'mostly eating out' : 'a mix'}{n.habits.mealsPerDay ? `, ${n.habits.mealsPerDay} per day` : ''}</li>
          <li>Requirements: {n.diet.length ? n.diet.join(', ') : 'none'}{n.allergens.length ? `; allergies: ${n.allergens.join(', ')}` : ''}</li>
        </ul>
      )}
      <button type="button" className="btn btn-secondary" onClick={start}>
        {n?.status === 'complete' ? 'Open AdaptFit Fuel' : n?.status === 'in-progress' ? 'Continue setup' : 'Set up AdaptFit Fuel'}
      </button>
      {old && (
        <p className="xs muted">
          Notes from V0.2 are kept{old.restrictions.length ? ` (${old.restrictions.join(', ')})` : ''} and reused when you set up Fuel.
        </p>
      )}
    </SettingsGroup>
  );
}

const ZONES = ['Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Jakarta', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC'];

function UnitsSection() {
  const { profile, save, status } = useProfileSaver();
  const id = useId();
  const zones = ZONES.includes(profile.timezone) ? ZONES : [profile.timezone, ...ZONES];
  return (
    <SettingsGroup icon={<IconTrain />} title="Units & region" subtitle={`${profile.weightUnit} · ${profile.timezone}`}>
      <RadioGroup
        legend="Weight unit for new sessions"
        name="s-unit"
        choices={[
          { value: 'kg', label: 'Kilograms (kg)' },
          { value: 'lb', label: 'Pounds (lb)' },
        ]}
        value={profile.weightUnit}
        onChange={(v) => void save({ weightUnit: v }, 'Unit saved. Past sessions keep the unit they were recorded in.')}
        description="Past sessions keep the unit they were recorded in."
      />
      <div className="field">
        <label className="field-label" htmlFor={id}>
          Time zone (day boundaries)
        </label>
        <select id={id} className="select" value={profile.timezone} onChange={(e) => void save({ timezone: e.target.value }, 'Time zone saved.')}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <StatusLine status={status} />
    </SettingsGroup>
  );
}

function GamificationSection() {
  const { profile, save, status } = useProfileSaver();
  return (
    <SettingsGroup icon={<IconGame />} title="Gamification" subtitle={profile.gamification ? 'Character, XP & missions on' : 'Off'}>
      <Switch label="Show character, XP, and missions" hint="Turning this off hides the RPG layer. Workouts, history, and progress are unaffected." checked={profile.gamification} onChange={(v) => void save({ gamification: v }, v ? 'Gamification on.' : 'Gamification off.')} />
      {profile.gamification && (
        <a href="#/journey" className="link-btn">
          Change character in Journey →
        </a>
      )}
      <StatusLine status={status} testId="gamification-status" />
    </SettingsGroup>
  );
}

function DataSection() {
  const { data } = useApp();
  const announce = useAnnounce();
  const [exportStatus, setExportStatus] = useState<Status>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const legacy = data.sessions.filter((s) => s.source === 'legacy').length;

  const doExport = async () => {
    try {
      const { createBackup, backupFileName } = await loadBackup();
      const now = clock.now();
      const backup = await createBackup(now);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(now);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const n = backup.data.sessions.filter((s) => s.state === 'completed').length;
      setExportStatus({ tone: 'ok', text: `Backup downloaded (${n} completed workout${n === 1 ? '' : 's'}, ${backup.data.programmes.length} programme${backup.data.programmes.length === 1 ? '' : 's'}).` });
    } catch (err) {
      setExportStatus({ tone: 'error', text: err instanceof Error ? err.message : 'Export failed.' });
    }
  };

  return (
    <SettingsGroup icon={<IconDatabase />} title="Data & backups" subtitle="Export · Restore · Reset" defaultOpen>
      <p className="small muted">
        Everything stays in this browser on this device. Storage is per device and web address and can be cleared by the browser. Export regularly; backups contain your training and lifestyle data, so keep them private.
      </p>
      <button type="button" className="btn btn-secondary btn-block" onClick={doExport}>
        Export backup (JSON)
      </button>
      <StatusLine status={exportStatus} testId="export-status" />
      <span className="section-label">Restore</span>
      <RestoreBackup hasExistingData />
      {legacy > 0 && (
        <p className="xs muted">
          {legacy} workout{legacy === 1 ? ' was' : 's were'} migrated from AdaptFit V0.1. Original copies are kept on this device and included in exports.
        </p>
      )}
      <span className="section-label">Reset</span>
      <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmReset(true)}>
        Erase all data…
      </button>
      {confirmReset && (
        <ConfirmDialog
          title="Erase all AdaptFit data?"
          confirmLabel="Erase everything"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={async () => {
            await resetAllData();
            announce('All AdaptFit data on this device was erased.');
            navigate('/train');
          }}
        >
          <p>This permanently removes your profile, programmes, workouts, coaching history, and progress from this device. Export a backup first if you might want it back.</p>
        </ConfirmDialog>
      )}
    </SettingsGroup>
  );
}

function PrivacySection() {
  const pwa = usePwa();
  const items: ReactNode[] = [
    'No account, cloud storage, analytics, ads, or third-party scripts.',
    'Training, lifestyle, and character data never leave this device unless you export a backup.',
    'Coaching runs locally with transparent rules — no external AI service.',
    'AdaptFit offers general fitness guidance for adults. It does not diagnose, give medical clearance, or replace a qualified professional.',
  ];
  return (
    <SettingsGroup icon={<IconShield />} title="Privacy & about" subtitle={pwa.offlineReady ? 'Offline ready' : 'Local-first'}>
      <ul className="bullet-list">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <p className="small row">
        <IconInfo size={16} /> Offline: {pwa.offlineReady ? 'ready — works without a connection' : pwa.supported ? 'not ready yet (needs one online load of the production build)' : 'not supported in this browser'}
      </p>
      <p className="xs faint">AdaptFit V0.2</p>
    </SettingsGroup>
  );
}
