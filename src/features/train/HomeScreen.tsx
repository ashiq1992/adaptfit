import { useMemo, useState } from 'react';
import { saveNutrition } from '../../data/repo';
import { emptyNutritionProfile, seedFromLifestyle } from '../../domain/nutrition';
import { exerciseHistory, compare, IMPROVING, weekStartOf } from '../../domain/progression';
import { estimateDayMinutes, isUsableProgramme, nextPlannedSession, shortenDay } from '../../domain/programme';
import { recommend } from '../../domain/recommend';
import { comparableKey } from '../../domain/loads';
import type { ProgrammeDay, WorkoutSession } from '../../domain/types';
import { completedSetCount, previousPerformance, suggestTarget } from '../../domain/workout';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { useApp } from '../../ui/DataContext';
import { navigate } from '../../ui/hooks';
import { IconBolt, IconCalendar, IconChevronDown, IconChevronRight, IconClock, IconCoach, IconPlay, IconSpark, IconTrain } from '../../ui/icons';
import { Progress } from '../../ui/controls';
import { CharacterCard } from '../journey/CharacterCard';
import { FuelPrompt } from '../programmes/GuidedProgramme';
import { greeting, longDate, repRange, setLabel } from '../format';
import { ReadinessDialog } from './ReadinessDialog';
import { startDay, startQuick } from './start';

export function HomeScreen() {
  const { data, today, rpg } = useApp();
  const { profile, activeProgramme, active, sessions, completed, checkIns, recommendations } = data;
  const [readinessOpen, setReadinessOpen] = useState(false);
  const checkIn = checkIns.find((c) => c.localDate === today);
  const missions = rpg.missions;
  const missionsDone = missions.filter((m) => m.done).length;

  return (
    <div className="screen">
      <div className="screen-head">
        <div>
          <h1 tabIndex={-1} className="greeting">
            {greeting(clock.now(), profile.timezone)}
          </h1>
          <p className="muted small">{longDate(today)} · Ready to train?</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          {profile.gamification && <CharacterCard rpg={rpg} character={data.profile.character} compact />}

          {active ? (
            <ResumeCard session={active} />
          ) : checkIn?.safetyConcern ? (
            <RestCard concern={checkIn.safetyConcern} onEdit={() => setReadinessOpen(true)} />
          ) : isUsableProgramme(activeProgramme) ? (
            <NextWorkoutCard onAdjust={() => setReadinessOpen(true)} />
          ) : (
            <SetupCard hasProgramme={!!activeProgramme} onAdjust={() => setReadinessOpen(true)} />
          )}
        </div>

        <div className="stack sticky-col">
          {isUsableProgramme(activeProgramme) && !active && (!data.nutrition || data.nutrition.status === 'not-asked') && <TrainFuelPrompt />}
          <CoachInsight sessions={sessions} recommendationsOpen={recommendations.filter((r) => r.status === 'open').length} />
          {profile.gamification && missions.length > 0 && (
            <a href="#/journey" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row between">
                <span className="eyebrow">
                  <IconSpark size={16} /> Weekly missions
                </span>
                <span className="pill pill-mission num">
                  {missionsDone}/{missions.length}
                </span>
              </div>
              <Progress value={missionsDone} max={missions.length} label="Weekly missions" />
              <span className="xs muted">{missions.find((m) => !m.done)?.name ?? 'All missions complete this week.'}</span>
            </a>
          )}
          <div className="card">
            <div className="row between">
              <h2 className="card-title">Recent training</h2>
              <a href="#/train/history" className="link-btn">
                History <IconChevronRight size={16} />
              </a>
            </div>
            {completed.length === 0 ? (
              <p className="small muted">No workouts yet. Your completed sessions will appear here.</p>
            ) : (
              <ul className="stack-sm">
                {completed.slice(0, 3).map((s) => (
                  <li key={s.id} className="row between small">
                    <span className="strong">{s.name}</span>
                    <span className="muted num">
                      {s.completedLocalDate} · {completedSetCount(s)} sets
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {readinessOpen && <ReadinessDialog profile={profile} today={today} existing={checkIn} onClose={() => setReadinessOpen(false)} />}
    </div>
  );
}

function ResumeCard({ session }: { session: WorkoutSession }) {
  const ex = session.exercises[session.position];
  return (
    <section className="card card-glow" aria-labelledby="resume-title">
      <span className="eyebrow">
        <IconTrain size={16} /> Workout in progress
      </span>
      <h2 id="resume-title" className="workout-name">
        {session.name}
      </h2>
      <p className="small muted">
        {completedSetCount(session)} sets completed{ex ? ` · next up: ${ex.name}` : ''}. Your draft is saved on this device.
      </p>
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/workout')}>
        <IconPlay size={18} /> Resume workout
      </button>
    </section>
  );
}

function RestCard({ concern, onEdit }: { concern: string; onEdit: () => void }) {
  const text = concern === 'pain' ? 'pain' : concern === 'illness' ? 'feeling ill' : 'not feeling safe to train';
  return (
    <section className="card" data-testid="rest-card" aria-labelledby="rest-title">
      <span className="eyebrow">Today</span>
      <h2 id="rest-title" className="workout-name">
        Rest today
      </h2>
      <p>You noted {text}, so today is a rest day. Take it easy.</p>
      <ul className="bullet-list">
        <li>Rest is a normal, useful part of training.</li>
        <li>If you feel like moving, keep it to easy activity that feels comfortable.</li>
        <li>If pain, illness, or feeling unsafe continues or worsens, consider a qualified health professional. If it feels urgent, contact emergency services.</li>
      </ul>
      <button type="button" className="btn btn-tertiary btn-block" onClick={onEdit}>
        Edit check-in
      </button>
    </section>
  );
}

function NextWorkoutCard({ onAdjust }: { onAdjust: () => void }) {
  const { data, today } = useApp();
  const programme = data.activeProgramme!;
  const announce = useAnnounce();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useShort, setUseShort] = useState<boolean | null>(null);
  const checkIn = data.checkIns.find((c) => c.localDate === today) ?? null;

  const next = useMemo(() => nextPlannedSession(programme, data.sessions, data.weekPlans, weekStartOf(today)), [programme, data.sessions, data.weekPlans, today]);
  if (!next) return null;
  const fullMinutes = estimateDayMinutes(next.day);
  const short = checkIn && checkIn.availableMinutes < fullMinutes ? shortenDay(next.day, checkIn.availableMinutes) : null;
  const day: ProgrammeDay = short && useShort ? short.day : next.day;
  const key = day.exercises.find((e) => e.priority) ?? day.exercises[0]!;
  const prev = previousPerformance(data.sessions, key.exerciseId, key.loadType);
  const target = suggestTarget({ sets: key.sets, repMin: key.repMin, repMax: key.repMax, durationSec: key.durationSec, restSec: key.restSec }, prev, key.loadType);
  const top = prev ? prev.sets.reduce((a, b) => ((b.load ?? 0) > (a.load ?? 0) || ((b.load ?? 0) === (a.load ?? 0) && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a)) : null;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const planKind = short && useShort ? 'shortened' : next.planKind;
      const { created } = await startDay({ programme, day, planKind, history: data.sessions, profile: data.profile, checkIn });
      announce(created ? 'Workout started.' : 'Resuming the workout already in progress.');
      navigate('/workout');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start.');
      setBusy(false);
    }
  };

  return (
    <section className="card card-glow" aria-labelledby="next-title">
      <div className="row between">
        <span className="eyebrow">
          <IconCalendar size={16} /> Today's workout
        </span>
        <span className="xs muted">{programme.name}</span>
      </div>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 id="next-title" className="workout-name">
            {day.name}
          </h2>
          <p className="small muted num">
            {day.exercises.length} exercises · ~{estimateDayMinutes(day)} min
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" aria-expanded={expanded} aria-controls="next-exercises" aria-label={expanded ? 'Hide exercises' : 'Show exercises'} onClick={() => setExpanded((v) => !v)}>
          <IconChevronDown />
        </button>
      </div>
      {next.note && <p className="xs teal">{next.note}</p>}
      <ul id="next-exercises" className="ex-preview" hidden={!expanded}>
        {day.exercises.map((e) => (
          <li key={e.id}>
            <span>
              {e.name} {e.priority && <span className="prio">★ priority</span>}
            </span>
            <span className="muted num">
              {e.sets} × {e.loadType === 'timed' ? `${e.durationSec}s` : repRange(e.repMin, e.repMax)}
            </span>
          </li>
        ))}
      </ul>

      <hr className="divider" />
      <div className="stack-sm">
        <span className="section-label">Key lift — {key.name}</span>
        {top && prev ? (
          <div className="keylift">
            <div className="keylift-box">
              <div className="label">Last session</div>
              <div className="value num" data-testid="last-session">
                {setLabel(top, key.loadType, prev.unit)}
              </div>
            </div>
            <div className="keylift-box target">
              <div className="label">Next target</div>
              <div className="value num">{target.kind === 'add-rep' && target.reps ? setLabel({ ...top, reps: target.reps }, key.loadType, prev.unit) : target.kind === 'consider-load' ? 'Small load increase' : setLabel(top, key.loadType, prev.unit)}</div>
            </div>
          </div>
        ) : (
          <p className="small muted">No previous record for this lift yet — today sets your baseline.</p>
        )}
        {target.text && <p className="xs muted">{target.text}</p>}
      </div>

      {short && useShort === null && (
        <div className="status-banner amber" role="region" aria-label="Shortened session proposal">
          <IconClock />
          <div className="stack-sm">
            <span className="strong small">
              You have {checkIn!.availableMinutes} min — the full session is ~{fullMinutes} min.
            </span>
            {short.fits ? (
              <>
                <span className="xs muted">Proposed shorter version (~{short.estimatedMinutes} min), priority lifts kept:</span>
                <ul className="bullet-list">
                  {short.changes.map((c) => (
                    <li key={c.kind + c.name}>{c.kind === 'removed' ? `Skip ${c.name}` : `${c.name}: ${c.from} → ${c.to} sets`}</li>
                  ))}
                </ul>
              </>
            ) : (
              <span className="xs muted">Even a shortened version won't fully fit. You can still start the full session or adjust your time.</span>
            )}
            <div className="row wrap">
              {short.fits && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setUseShort(true)}>
                  Use shorter version
                </button>
              )}
              <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setUseShort(false)}>
                Keep full session
              </button>
            </div>
          </div>
        </div>
      )}
      {short && useShort && <p className="xs teal">Using the shorter version you approved.</p>}

      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={start} disabled={busy}>
        <IconPlay size={18} /> Start workout
      </button>
      <button type="button" className="link-btn" onClick={onAdjust}>
        <IconBolt size={16} /> Adjust for today (time, how you feel)
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function SetupCard({ hasProgramme, onAdjust }: { hasProgramme: boolean; onAdjust: () => void }) {
  const { data, today } = useApp();
  const checkIn = data.checkIns.find((c) => c.localDate === today) ?? null;

  const quick = async () => {
    const ci = checkIn ?? {
      localDate: today,
      availableMinutes: data.profile.preferredMinutes,
      energy: 'medium' as const,
      soreness: 'none' as const,
      equipment: data.profile.equipment,
      safetyConcern: null,
      sleepHours: null,
      sleepQuality: null,
      fatigue: null,
      stress: null,
      updatedAt: clock.now().toISOString(),
    };
    const rec = recommend({ checkIn: ci, profile: data.profile, sessions: data.sessions, now: clock.now() });
    if (rec.kind !== 'workout') {
      onAdjust();
      return;
    }
    await startQuick({ plan: rec.plan, history: data.sessions, profile: data.profile, checkIn: ci });
    navigate('/workout');
  };

  return (
    <section className="card card-glow" aria-labelledby="setup-title" data-testid="setup-card">
      <span className="eyebrow">
        <IconCalendar size={16} /> {hasProgramme ? 'Finish your programme' : 'Your training programme'}
      </span>
      <h2 id="setup-title" className="workout-name">
        {hasProgramme ? 'Your programme needs a few details' : 'Create your programme'}
      </h2>
      {hasProgramme ? (
        <a href={`#/programmes/${data.activeProgramme!.id}`} className="btn btn-primary btn-lg btn-block">
          Edit programme
        </a>
      ) : (
        <div className="stack-sm">
          <a href="#/programmes/guide" className="btn btn-primary btn-lg btn-block">
            Recommend a programme
          </a>
          <a href="#/programmes/import" className="btn btn-secondary btn-block">
            Use my existing programme
          </a>
          <a href="#/programmes/new" className="btn btn-tertiary btn-block">
            Build from scratch
          </a>
        </div>
      )}
      <p className="xs muted">AdaptFit follows the programme you choose and never swaps it for a generic workout. Existing programmes are never replaced without your say-so.</p>
      <hr className="divider" />
      <p className="xs muted">Just want to train today? Choose a one-off adaptive session based on your time and equipment.</p>
      <button type="button" className="btn btn-tertiary btn-block" onClick={quick}>
        Quick adaptive workout
      </button>
    </section>
  );
}

function TrainFuelPrompt() {
  const { data } = useApp();
  const choose = async (yes: boolean) => {
    const now = clock.now();
    const n = seedFromLifestyle(data.nutrition ?? emptyNutritionProfile(now), data.profile.lifestyle);
    await saveNutrition({ ...n, status: yes ? 'in-progress' : 'declined', updatedAt: now.toISOString() });
    if (yes) navigate('/coach/fuel');
  };
  return <FuelPrompt onChoose={(yes) => void choose(yes)} />;
}

function CoachInsight({ sessions, recommendationsOpen }: { sessions: WorkoutSession[]; recommendationsOpen: number }) {
  const { data } = useApp();
  let title = 'Coach insight';
  let text: string;
  if (recommendationsOpen > 0) {
    text = `You have ${recommendationsOpen} open recommendation${recommendationsOpen === 1 ? '' : 's'} to review. Nothing changes until you decide.`;
  } else {
    const prio = data.activeProgramme?.days.flatMap((d) => d.exercises).find((e) => e.priority);
    const pts = prio ? exerciseHistory(sessions, comparableKey(prio.exerciseId, prio.loadType)) : [];
    if (prio && pts.length >= 2) {
      const c = compare(pts[pts.length - 1]!.summary, pts[pts.length - 2]!.summary);
      title = prio.name;
      text = IMPROVING.has(c.kind)
        ? `Improving last session (${c.label}). Keep the same plan and build on it.`
        : c.kind === 'regression'
          ? `Slightly down last session (${c.label}). One session isn't a trend — keep the plan.`
          : 'Your performance is stable. Keep the same plan and aim for +1 rep when technique allows.';
    } else text = 'Complete a few sessions and AdaptFit will compare your lifts against your own previous records.';
  }
  return (
    <a href="#/coach" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="insight">
        <span className="insight-icon">
          <IconCoach size={20} />
        </span>
        <div>
          <span className="strong small">{title}</span>
          <p className="small muted">{text}</p>
        </div>
      </div>
    </a>
  );
}
