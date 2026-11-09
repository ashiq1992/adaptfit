import { type ReactNode, useId, useState } from 'react';
import { resetAllData, saveNote, saveNutrition, saveProfile } from '../../data/repo';
import { setUsageCount, usageCountAvailable, useUsageCountOn } from '../../data/usageCount';
import { emptyNutritionProfile, seedFromLifestyle } from '../../domain/nutrition';
import { type Lifestyle, type Profile, TRAINING_WINDOWS, type TrainingWindow } from '../../domain/types';
import { usePwa } from '../../pwa';
import { useAnnounce } from '../../ui/Announcer';
import { RadioGroup } from '../../ui/ChoiceGroup';
import { clock } from '../../ui/clock';
import { DayPicker, SettingsGroup, SettingsSection, Switch } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { ConfirmDialog } from '../../ui/Dialog';
import { navigate } from '../../ui/hooks';
import { IconBriefcase, IconCalendar, IconDatabase, IconDownload, IconInfo, IconMoon, IconNotes, IconPalette, IconShield, IconTrain, IconUser, IconUtensils } from '../../ui/icons';
import { setTheme, THEMES, useTheme } from '../../ui/theme';
import { ScreenHeader } from '../../ui/ScreenHeader';
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

/** Compact settings. Workout notes themselves are managed from Plan. */
export function SettingsScreen() {
  return (
    <div className="screen">
      <ScreenHeader back={{ href: '#/plan', label: 'Plan' }} title="Settings" />
      <div className="settings">
        <SettingsSection title="Training">
          <GoalsSection />
          <AvailabilitySection />
          <LoggingSection />
          <UnitsSection />
        </SettingsSection>
        <SettingsSection title="Lifestyle">
          <WorkSection />
          <SleepSection />
          <NutritionSection />
        </SettingsSection>
        <SettingsSection title="App">
          <AppearanceSection />
          <InstallSection />
        </SettingsSection>
        <SettingsSection title="Data & privacy">
          <DataSection />
          <PrivacySection />
        </SettingsSection>
      </div>
    </div>
  );
}

/** Paper (default), Night, or follow the device. Stored on this device only. */
function AppearanceSection() {
  const theme = useTheme();
  const announce = useAnnounce();
  return (
    <SettingsGroup icon={<IconPalette />} title="Appearance" subtitle={THEMES.find((t) => t.id === theme)?.label ?? 'Paper'}>
      <fieldset className="field">
        <legend className="field-label">Theme</legend>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              className="seg-btn"
              onClick={() => {
                setTheme(t.id);
                announce(`${t.label} theme on.`);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="field-hint">Paper is warm and easy to read in daylight; Night is the same design in dark ink for the evening. Saved on this device only.</p>
      </fieldset>
    </SettingsGroup>
  );
}

function LoggingSection() {
  const { profile, save, status } = useProfileSaver();
  return (
    <SettingsGroup icon={<IconNotes />} title="Logging and reminders" subtitle={profile.loggingMode === 'live' ? 'Weekly updates + live logging' : 'Weekly updates'}>
      <Switch
        label="Show “Log live” on each day"
        hint="Optional set-by-set logging with timers. Off: it stays in each day’s ⋯ menu. Either way, weekly updates give the same analysis."
        checked={profile.loggingMode === 'live'}
        onChange={(v) => void save({ loggingMode: v ? 'live' : 'weekly' }, v ? 'Live logging shown.' : 'Live logging moved to the day menu.')}
      />
      <Switch label="Weekly update reminder on Plan" hint="A quiet line on Plan from Friday. No push notifications." checked={profile.notifications.weeklyReminder} onChange={(v) => void save({ notifications: { ...profile.notifications, weeklyReminder: v } }, 'Reminder saved.')} />
      <Switch label="Dot on Coach for new findings" checked={profile.notifications.coachFindings} onChange={(v) => void save({ notifications: { ...profile.notifications, coachFindings: v } }, 'Saved.')} />
      <StatusLine status={status} testId="logging-status" />
    </SettingsGroup>
  );
}

function InstallSection() {
  const pwa = usePwa();
  return (
    <SettingsGroup icon={<IconDownload />} title="Install the app" subtitle={pwa.offlineReady ? 'Works offline' : 'Add to Home Screen'}>
      <p className="small">
        <span className="strong">iPhone (Safari):</span> tap Share, then <em>Add to Home Screen</em>. Open AdaptFit from the new icon; it runs full screen.
      </p>
      <p className="small">
        <span className="strong">Android (Chrome):</span> tap ⋮, then <em>Install app</em> (or <em>Add to Home screen</em>).
      </p>
      <p className="xs muted">Installing and offline use need the app to be served over HTTPS (or from this computer as localhost). Your data stays on each device separately — use Export and Restore to move it.</p>
      <p className="small row" data-testid="offline-status" data-offline-ready={pwa.offlineReady ? 'true' : 'false'}>
        <IconInfo size={16} /> Offline: {pwa.offlineReady ? 'ready — works without a connection' : pwa.supported ? 'not ready yet (needs one online visit to the installed version)' : 'not available here'}
      </p>
    </SettingsGroup>
  );
}

function GoalsSection() {
  const { profile, save, status } = useProfileSaver();
  return (
    <SettingsGroup icon={<IconUser />} title="Training goals" subtitle={`${GOAL_CHOICES.find((g) => g.value === profile.goal)?.label ?? profile.goal} · ${profile.experience}`}>
      <RadioGroup legend="Main goal" name="s-goal" layout="cards" choices={GOAL_CHOICES} value={profile.goal} onChange={(v) => void save({ goal: v }, 'Goal saved.')} />
      <RadioGroup legend="Training experience" name="s-exp" layout="cards" choices={EXPERIENCE_CHOICES} value={profile.experience} onChange={(v) => void save({ experience: v }, 'Experience saved.')} />
      <StatusLine status={status} testId="goals-status" />
    </SettingsGroup>
  );
}

function AvailabilitySection() {
  const { profile, save, status } = useProfileSaver();
  const { data } = useApp();
  const announce = useAnnounce();
  const t = profile.lifestyle.training ?? { minDays: null, preferredDays: [] };
  const setTraining = (patch: Partial<NonNullable<Lifestyle['training']>>) => save({ lifestyle: { ...profile.lifestyle, training: { ...t, ...patch } } }, 'Availability saved.');
  return (
    <SettingsGroup icon={<IconCalendar />} title="Weekly schedule" subtitle={`${data.activeProgramme?.daysPerWeek ?? '—'} days/week · ${profile.preferredMinutes} min sessions`}>
      <RadioGroup
        legend="Preferred session length"
        name="s-len" layout="row"
        choices={[30, 45, 60, 75, 90].map((m) => ({ value: m, label: `${m} min` }))}
        value={profile.preferredMinutes}
        onChange={(v) => void save({ preferredMinutes: v }, 'Session length saved.')}
      />
      <DayPicker legend="Preferred gym days" value={t.preferredDays} onChange={(v) => void setTraining({ preferredDays: v })} />
      <RadioGroup
        legend="Minimum sessions in a busy week"
        name="s-min" layout="row"
        choices={[{ value: 0, label: 'Not set' }, ...[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))]}
        value={t.minDays ?? 0}
        onChange={(v) => void setTraining({ minDays: v === 0 ? null : v })}
      />
      {data.activeProgramme && (
        <RadioGroup
          legend={`Sessions per week in “${data.activeProgramme.name}”`}
          name="s-days" layout="row"
          choices={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
          value={data.activeProgramme.daysPerWeek}
          onChange={(v) => void saveNote({ ...data.activeProgramme!, daysPerWeek: v }, 'Changed frequency', clock.now()).then(() => announce(`${v} sessions per week.`))}
        />
      )}
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
        name="s-ot" layout="row"
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
        name="s-sq" layout="row"
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
    <SettingsGroup icon={<IconUtensils />} title="Nutrition (AdaptFit Fuel)" subtitle={status} id="nutrition">
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
    <SettingsGroup icon={<IconTrain />} title="Units & weight conventions" subtitle={`${profile.weightUnit} · ${profile.timezone}`}>
      <p className="small muted">How a load is measured (total, per side, per dumbbell, added, assisted) is set per exercise in your note. When a note just says “30 kg” for a plate-loaded lift, AdaptFit asks instead of guessing, and never assumes a bar weight.</p>
      <RadioGroup
        legend="Weight unit for new sessions"
        name="s-unit" layout="row"
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
        Everything stays in this browser on this device, including deleted notes’ last copies. Storage is per device and web address and can be cleared by the browser. Export regularly; backups contain your training and lifestyle data, so keep them private.
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
            navigate('/plan');
          }}
        >
          <p>This permanently removes your profile, programmes, workouts, coaching history, and progress from this device. Export a backup first if you might want it back.</p>
        </ConfirmDialog>
      )}
    </SettingsGroup>
  );
}

function UsageCountSwitch() {
  const on = useUsageCountOn();
  const announce = useAnnounce();
  return (
    <div className="stack-sm" data-testid="usage-count">
      <Switch
        label="Help count active users (anonymous)"
        hint="Once a day, sends a random ID made on this phone, the app version, and whether it’s installed. Never your workouts, notes, body data, or name. Off deletes this phone’s count."
        checked={on}
        onChange={(v) => {
          void setUsageCount(v);
          announce(v ? 'Thanks — anonymous count on.' : 'Anonymous count off. This phone’s count is being deleted.');
        }}
      />
    </div>
  );
}

function PrivacySection() {
  const counting = usageCountAvailable();
  const items: ReactNode[] = [
    counting
      ? 'No account, cloud storage, ads, or third-party scripts. The only thing that can leave this phone is the anonymous count below, and only if you switch it on.'
      : 'No account, cloud storage, analytics, ads, or third-party scripts.',
    'Training, lifestyle, and nutrition data never leave this device unless you export a backup.',
    'Coaching runs locally with transparent rules — no external AI service.',
    'AdaptFit offers general fitness guidance for adults. It does not diagnose, give medical clearance, or replace a qualified professional.',
  ];
  return (
    <SettingsGroup icon={<IconShield />} title="Privacy & about" subtitle="Local-first">
      <ul className="bullet-list">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      {counting && <UsageCountSwitch />}
      <p className="xs faint">AdaptFit V0.5 · Intelligent Workout Notebook</p>
      <a href="#/admin" className="btn btn-secondary">
        Admin: this device’s storage and usage
      </a>
    </SettingsGroup>
  );
}
