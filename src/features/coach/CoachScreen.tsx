import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { addRecommendation, decideRecommendation, markWeekReviewed, newId, saveRecommendation, saveWeekPlan } from '../../data/repo';
import { answerQuestion, followUpOutcome, newPlateauRecommendation, weeklyReview } from '../../domain/coach';
import { addDays } from '../../domain/dates';
import { detectPlateaus } from '../../domain/plateau';
import { nextDay } from '../../domain/programme';
import { weekStartOf } from '../../domain/progression';
import { bodyweightTrend } from '../../domain/bodyweight';
import { integrationFindings, integrationRecommendation } from '../../domain/integration';
import { plural, proposeWeek, suggestedAvailability, weekSchedule } from '../../domain/schedule';
import type { CoachQuestion, CoachRecommendation, ProgrammeChange, WeekPlan } from '../../domain/types';
import { priorityKeys } from '../../data/useAppData';
import { useAnnounce } from '../../ui/Announcer';
import { Adventurer } from '../../ui/Adventurer';
import { clock } from '../../ui/clock';
import { ChangeLabel, Tabs } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { navigate } from '../../ui/hooks';
import { IconCalendar, IconCheck, IconInfo, IconMinus, IconMoon, IconPlus, IconSpark } from '../../ui/icons';
import { shortDate } from '../format';

/** Automatic plateau recommendations per week. */
const MAX_AUTO_RECOMMENDATIONS = 2;

const FuelScreen = lazy(() => import('../fuel/FuelScreen').then((m) => ({ default: m.FuelScreen })));

const TABS = [
  { id: 'week', label: 'This Week' },
  { id: 'insights', label: 'Insights' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'history', label: 'History' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Coach tabs are part of the URL (#/coach/fuel) so they can be linked to and survive refresh. */
export function CoachScreen({ tab: routeTab }: { tab: string | null }) {
  const tab: TabId = TABS.some((t) => t.id === routeTab) ? (routeTab as TabId) : 'week';
  const setTab = (t: TabId) => navigate(t === 'week' ? '/coach' : `/coach/${t}`);
  const { data } = useApp();
  const open = data.recommendations.filter((r) => r.status === 'open').length;
  return (
    <div className="screen">
      <div className="screen-head">
        <h1 tabIndex={-1}>Coach</h1>
        {open > 0 && <span className="pill pill-new">{open} to review</span>}
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Coach views" idBase="coach" />
      <div id="coach-panel" role="tabpanel" aria-labelledby={`coach-tab-${tab}`} className="stack">
        {tab === 'week' && <ThisWeek />}
        {tab === 'insights' && <Insights />}
        {tab === 'fuel' && (
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <FuelScreen />
          </Suspense>
        )}
        {tab === 'history' && <RecHistory />}
      </div>
      <p className="xs faint">AdaptFit gives general training and nutrition guidance from your own records. It does not diagnose or treat, and never changes your programme or targets without your approval.</p>
    </div>
  );
}

function ThisWeek() {
  const { data, today, rpg } = useApp();
  const ws = weekStartOf(today);
  const review = useMemo(() => weeklyReview({ sessions: data.sessions, programme: data.activeProgramme, weekPlans: data.weekPlans, checkIns: data.checkIns, today }), [data, today]);

  useEffect(() => {
    if (!data.reviewedWeeks.includes(ws)) void markWeekReviewed(ws);
  }, [ws, data.reviewedWeeks]);

  const banner =
    review.status === 'complete'
      ? { tone: '', title: 'On track', text: review.headline }
      : review.status === 'on-track'
        ? { tone: '', title: 'On track', text: `${review.headline} There's still time this week.` }
        : review.status === 'behind'
          ? { tone: 'amber', title: 'Fewer sessions than planned', text: `${review.headline} Consider adjusting this week below — nothing is lost.` }
          : { tone: 'amber', title: 'No plan this week', text: review.headline };

  return (
    <div className="grid-2">
      <div className="stack">
        <section className="card" aria-labelledby="review-title">
          <div className="row between">
            <h2 id="review-title" className="card-title row">
              <IconCalendar size={20} /> Weekly review
            </h2>
            <span className="xs muted num">
              {shortDate(ws)} – {shortDate(addDays(ws, 6))}
            </span>
          </div>
          <div className={`status-banner ${banner.tone}`} data-testid="week-status">
            <IconCheck />
            <div>
              <span className="strong">{banner.title}</span>
              <p className="small muted">{banner.text}</p>
            </div>
          </div>
          <ul className="check-list small">
            <li data-testid="week-count">
              <IconCheck size={16} /> {review.completed} of {review.planned || '—'} planned {plural(review.planned, 'workout')}
              {review.planned > 0 ? ` · ${review.remaining} remaining` : ''}
              {review.adjusted ? ` (adjusted week; normally ${review.defaultFrequency})` : ''}
            </li>
            <li>
              <IconCheck size={16} /> Consistency (4 weeks): {review.consistencyPct !== null ? `${review.consistencyPct}%` : 'no planned weeks yet'}
            </li>
            <li>
              <IconMoon size={16} /> Recovery: {review.recovery.avgSleep !== null ? `average sleep ${review.recovery.avgSleep} h (${review.recovery.checkIns} check-ins)` : 'no sleep logged this week (optional)'}
            </li>
          </ul>
          <NutritionLine />
          {review.keyLifts.length > 0 ? (
            <div className="stack-sm">
              <span className="section-label">Key lifts (4 weeks)</span>
              <div className="change-list">
                {review.keyLifts.map((k) => (
                  <ChangeLabel key={k.name} name={k.name} kind={k.kind as never} label={k.label} />
                ))}
              </div>
            </div>
          ) : (
            <p className="xs muted">Mark exercises as priority in your programme to track key lifts here.</p>
          )}
          {data.profile.gamification && (
            <div className="row" style={{ gap: 12 }}>
              <div className="scene-frame" style={{ width: 56, height: 56 }}>
                <Adventurer styleId={data.profile.character.style} hidden={data.profile.character.hiddenLayers} level={rpg.level.level} size={48} decorative />
              </div>
              <span className="xs muted">Weekly review complete — mission progress saved.</span>
            </div>
          )}
        </section>
      </div>
      <div className="stack">
        <WeekPlanner />
      </div>
    </div>
  );
}

function WeekPlanner() {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const programme = data.activeProgramme;
  const ws = weekStartOf(today);
  const existing = data.weekPlans.find((w) => w.weekStart === ws);
  const schedule = weekSchedule(programme, data.weekPlans, data.sessions, ws);
  const planned = schedule.defaultFrequency;
  const hint = programme ? suggestedAvailability(data.profile.lifestyle, planned) : null;
  const [available, setAvailable] = useState(existing?.availableSessions ?? hint?.sessions ?? planned);
  const [proposal, setProposal] = useState<WeekPlan | null>(null);

  if (!programme) {
    return (
      <section className="card">
        <h2 className="card-title">Plan this week</h2>
        <p className="small muted">Set up your programme to adapt weekly schedules.</p>
        <a href="#/programmes/new" className="btn btn-secondary">
          Create programme
        </a>
      </section>
    );
  }

  const propose = () => {
    const next = nextDay(programme, data.sessions);
    setProposal(proposeWeek({ programme, weekStart: ws, availableSessions: available, nextDayId: next?.id ?? null, sessionLengthMin: data.profile.preferredMinutes + 15 }));
  };
  const decide = async (status: 'approved' | 'rejected', plan: WeekPlan) => {
    await saveWeekPlan({ ...plan, status, decidedAt: clock.now().toISOString() });
    setProposal(null);
    announce(status === 'approved' ? 'Adjusted week approved. Train will follow it.' : 'Proposal rejected. Your normal programme continues.');
  };

  return (
    <section className="card" aria-labelledby="planner-title">
      <h2 id="planner-title" className="card-title row">
        <IconSpark size={20} /> Plan this week
      </h2>
      {existing?.status === 'approved' && !proposal ? (
        <>
          <div className="status-banner" data-testid="approved-week">
            <IconCheck />
            <div className="small">
              <span className="strong">Adjusted week approved</span>
              <p className="muted">
                {existing.availableSessions} of {existing.plannedSessions} sessions: {existing.sessions.map((s) => s.name).join(', ')}.
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-tertiary" onClick={() => decide('rejected', existing)}>
            Return to normal schedule
          </button>
        </>
      ) : (
        <>
          <p className="small muted" data-testid="planner-normal">
            Normally {planned} {plural(planned, 'session')} a week{schedule.completed ? ` · ${schedule.completed} done so far` : ''}. Busy week? Tell AdaptFit how many you can realistically do.
          </p>
          {hint && <p className="xs teal">{hint.reason}</p>}
          <div className="row" role="group" aria-label="Sessions available this week">
            <button type="button" className="step-btn" aria-label="Fewer sessions" onClick={() => setAvailable((v) => Math.max(0, v - 1))}>
              <IconMinus />
            </button>
            <span className="metric-val num" style={{ minWidth: 80, textAlign: 'center' }} aria-live="polite" data-testid="available-sessions">
              {available} / {planned}
            </span>
            <button type="button" className="step-btn" aria-label="More sessions" onClick={() => setAvailable((v) => Math.min(planned, v + 1))}>
              <IconPlus />
            </button>
          </div>
          <button type="button" className="btn btn-secondary" onClick={propose} disabled={available >= planned}>
            Propose adjusted week
          </button>
        </>
      )}
      {proposal && (
        <div className="stack-sm" data-testid="week-proposal">
          <span className="section-label">Proposed sessions</span>
          <ol className="stack-sm">
            {proposal.sessions.map((s) => (
              <li key={s.dayId} className="diff">
                <span className="strong">{s.name}</span> <span className="muted num">~{s.estimatedMinutes} min</span>
                {s.added.map((a) => (
                  <span key={a.programmeExerciseId} className="xs teal" style={{ display: 'block' }}>
                    + {a.name} ({a.sets} sets, from {a.fromDay})
                  </span>
                ))}
              </li>
            ))}
          </ol>
          <span className="section-label">Trade-offs</span>
          <ul className="bullet-list">
            {proposal.tradeoffs.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="row wrap">
            <button type="button" className="btn btn-primary btn-grow" onClick={() => decide('approved', proposal)}>
              Apply plan
            </button>
            <button type="button" className="btn btn-tertiary btn-grow" onClick={() => decide('rejected', proposal)}>
              Not now
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Insights() {
  const { data, today } = useApp();
  const findings = useMemo(
    () => detectPlateaus(data.sessions, today, { checkIns: data.checkIns, profile: data.profile, priorityKeys: priorityKeys(data.activeProgramme) }),
    [data.sessions, data.checkIns, data.profile, data.activeProgramme, today],
  );
  const painReports = data.checkIns.filter((c) => c.safetyConcern === 'pain' && c.localDate >= addDays(today, -28)).length;

  // Raise recommendations automatically only for priority lifts (at most two
  // per week) so the coach never turns into a long questionnaire. Other
  // possible plateaus are listed and can be reviewed on demand.
  const prio = priorityKeys(data.activeProgramme);
  const plateaus = findings.filter((f) => f.status === 'possible-plateau');
  const auto = (prio.size ? plateaus.filter((f) => prio.has(f.key)) : plateaus).slice(0, MAX_AUTO_RECOMMENDATIONS);
  const raise = (f: (typeof findings)[number]) =>
    addRecommendation(newPlateauRecommendation({ id: newId(), now: clock.now(), today, finding: f, programme: data.activeProgramme, recentPainReports: painReports }));
  const autoKeys = auto.map((f) => f.key).join('|');
  useEffect(() => {
    for (const f of auto) void raise(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKeys, today]);

  // Training and nutrition context, only when there is something relevant to say.
  const review = useMemo(() => weeklyReview({ sessions: data.sessions, programme: data.activeProgramme, weekPlans: data.weekPlans, checkIns: data.checkIns, today }), [data, today]);
  const nutritionFindings = useMemo(
    () => integrationFindings({ profile: data.profile, nutrition: data.nutrition, bodyweights: data.bodyweights, today, behindThisWeek: review.status === 'behind' }),
    [data.profile, data.nutrition, data.bodyweights, today, review.status],
  );
  const nutritionKeys = nutritionFindings.map((f) => f.id).join('|');
  useEffect(() => {
    for (const f of nutritionFindings) void addRecommendation(integrationRecommendation(f, newId(), clock.now(), today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nutritionKeys, today]);

  const raisedKeys = new Set(data.recommendations.filter((r) => r.kind === 'plateau' && r.dedupeKey.endsWith(weekStartOf(today))).map((r) => r.exerciseKey));
  const watching = plateaus.filter((f) => !raisedKeys.has(f.key));

  const active = data.recommendations.filter((r) => r.status === 'open' || (r.status === 'postponed' && (r.postponedUntil ?? '') <= today));
  const progressing = findings.filter((f) => f.status === 'progressing');
  const stable = findings.filter((f) => f.status === 'stable');
  const other = findings.filter((f) => f.status === 'insufficient-data' || f.status === 'interrupted');
  const judged = progressing.length + stable.length + plateaus.length;

  // Never claim "no plateau" when there isn't enough history to judge.
  const banner =
    active.length > 0
      ? null
      : findings.length === 0
        ? { testId: 'insufficient-banner', title: 'Not enough data yet', text: 'Log a few sessions first. A lift is assessed once it has 4 comparable sessions over at least 2 weeks.' }
        : judged === 0
          ? { testId: 'insufficient-banner', title: 'Not enough data to judge yet', text: `None of your ${findings.length} tracked ${plural(findings.length, 'lift')} has enough comparable history yet. See what is needed below.` }
          : plateaus.length === 0
            ? {
                testId: 'no-plateau',
                title: 'No plateau detected',
                text: `Based on ${judged} ${plural(judged, 'lift')} with enough history.${other.length ? ` ${other.length} more cannot be judged yet.` : ''}`,
              }
            : null;

  return (
    <>
      {banner && (
        <div className={`status-banner ${banner.testId === 'insufficient-banner' ? 'amber' : ''}`} data-testid={banner.testId}>
          {banner.testId === 'insufficient-banner' ? <IconInfo /> : <IconCheck />}
          <div>
            <span className="strong">{banner.title}</span>
            <p className="small muted">{banner.text}</p>
          </div>
        </div>
      )}
      {active.map((r) => (
        <RecommendationCard key={r.id} rec={r} painReports={painReports} />
      ))}
      {watching.length > 0 && (
        <section className="card" data-testid="watch-list">
          <h2 className="card-title">Worth watching</h2>
          <p className="xs muted">No recent improvement on these, but they aren't priority lifts. Ask for a suggestion only if you want one.</p>
          <ul className="change-rows">
            {watching.map((f) => (
              <li key={f.key}>
                <span className="small">{f.name}</span>
                <button type="button" className="btn btn-tertiary btn-sm" onClick={() => void raise(f)}>
                  Get suggestion
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(progressing.length > 0 || stable.length > 0) && (
        <section className="card">
          <h2 className="card-title">Improving and stable</h2>
          <ul className="change-rows">
            {[...progressing, ...stable].map((f) => (
              <li key={f.key} style={{ display: 'block' }}>
                <span className="row between">
                  <span className="small strong">{f.name}</span>
                  <span className={`pill ${f.status === 'progressing' ? 'pill-completed' : 'pill-mission'}`}>{f.status === 'progressing' ? 'Improving' : 'Stable'}</span>
                </span>
                <span className={`xs ${f.status === 'progressing' ? 'teal' : 'muted'}`}>{f.evidence[0]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {other.length > 0 && (
        <section className="card" data-testid="insufficient-list">
          <h2 className="card-title row">
            <IconInfo size={18} /> Not enough data to judge
          </h2>
          <ul className="bullet-list">
            {other.map((f) => (
              <li key={f.key}>
                <span className="strong">{f.name}:</span> {f.evidence[0]} {f.missingData[0] ? <span className="muted">{f.missingData[0]}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Nutrition and bodyweight context for the weekly review. Optional, never required. */
function NutritionLine() {
  const { data } = useApp();
  const n = data.nutrition;
  const trend = bodyweightTrend(data.bodyweights, data.profile.weightUnit);
  return (
    <ul className="check-list small" data-testid="review-nutrition">
      <li>
        <IconInfo size={16} />{' '}
        {n?.target?.kcal ? (
          <>
            Fuel target: <span className="num">{n.target.kcal} kcal</span>
            {n.target.proteinG ? (
              <>
                , protein <span className="num">{n.target.proteinG[0]}–{n.target.proteinG[1]} g</span>
              </>
            ) : null}
          </>
        ) : n?.target?.proteinG ? (
          <>
            Protein target {n.target.proteinG[0]}–{n.target.proteinG[1]} g (no calorie target set)
          </>
        ) : (
          <>
            Nutrition: not set up (optional) ·{' '}
            <a href="#/coach/fuel" className="link-btn">
              AdaptFit Fuel
            </a>
          </>
        )}
      </li>
      <li>
        <IconInfo size={16} /> Bodyweight: {data.bodyweights.length === 0 ? 'not recorded (optional)' : trend.status === 'insufficient' ? `${trend.text} ${trend.needed ?? ''}` : trend.text}
      </li>
    </ul>
  );
}

export function describeChange(c: ProgrammeChange): string {
  if (c.type === 'focus') return c.text;
  if (c.type === 'nutrition-target') return `Daily calorie target: ${c.fromKcal ?? '—'} → ${c.toKcal} kcal`;
  if (c.type === 'sets') return `${c.name}: ${c.from} → ${c.to} sets per session`;
  return `${c.name}: ${c.from[0]}–${c.from[1]} → ${c.to[0]}–${c.to[1]} reps`;
}

function RecommendationCard({ rec, painReports }: { rec: CoachRecommendation; painReports: number }) {
  const { data, today } = useApp();
  const announce = useAnnounce();
  const answer = async (id: CoachQuestion['id'], value: CoachQuestion['answer']) => {
    await saveRecommendation(answerQuestion(rec, id, value, data.activeProgramme, painReports));
  };
  const decide = async (d: 'accepted' | 'rejected' | 'postponed') => {
    await decideRecommendation(rec.id, d, clock.now(), today);
    announce(d === 'accepted' ? (rec.proposedChange?.type === 'nutrition-target' ? 'Accepted. Your calorie target was updated.' : rec.proposedChange && rec.proposedChange.type !== 'focus' ? 'Accepted. Your programme was updated.' : 'Accepted.') : d === 'rejected' ? 'Rejected. Your plan is unchanged.' : 'Postponed for a week.');
  };
  return (
    <section className="card card-amber" aria-labelledby={`rec-${rec.id}`} data-testid="recommendation">
      <div className="row between">
        <h2 id={`rec-${rec.id}`} className="card-title">
          {rec.trigger}
        </h2>
        <span className={`pill ${rec.kind === 'nutrition' ? 'pill-mission' : 'pill-pr'}`}>{rec.kind === 'nutrition' ? 'Training + nutrition' : 'Possible plateau'}</span>
      </div>
      {rec.kind === 'plateau' && <p className="small strong">Possible plateau — additional context needed.</p>}
      <div className="stack-sm">
        <span className="section-label">Evidence</span>
        <ul className="bullet-list">
          {rec.supportingData.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      {rec.missingData.length > 0 && (
        <div className="stack-sm">
          <span className="section-label">Missing information</span>
          <ul className="bullet-list">
            {rec.missingData.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {rec.questions.map((q) => (
        <div key={q.id} className="question" role="group" aria-label={q.text}>
          <span className="small strong">{q.text}</span>
          <div className="answer-row">
            {(['yes', 'no', 'unsure'] as const).map((v) => (
              <button key={v} type="button" className="btn btn-tertiary btn-sm" aria-pressed={q.answer === v} onClick={() => void answer(q.id, v)}>
                {v === 'unsure' ? 'Not sure' : v === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="stack-sm">
        <span className="section-label">Suggestion</span>
        <span className="strong">{rec.title}</span>
        <p className="small muted">{rec.explanation}</p>
        {rec.proposedChange && (
          <p className="diff" data-testid="proposed-change">
            {rec.proposedChange.type === 'focus' ? 'Focus: ' : rec.proposedChange.type === 'nutrition-target' ? 'Target change: ' : 'Programme change: '}
            {describeChange(rec.proposedChange)}
          </p>
        )}
      </div>
      <div className="row wrap">
        <button type="button" className="btn btn-primary btn-grow" onClick={() => void decide('accepted')}>
          <IconCheck size={18} /> Accept
        </button>
        <button type="button" className="btn btn-tertiary btn-grow" onClick={() => void decide('rejected')}>
          Reject
        </button>
        <button type="button" className="btn btn-ghost btn-grow" onClick={() => void decide('postponed')}>
          Later
        </button>
      </div>
    </section>
  );
}

function RecHistory() {
  const { data, today } = useApp();
  const decided = data.recommendations.filter((r) => r.status !== 'open');
  if (decided.length === 0) return <p className="muted">No decisions yet. Accepted, rejected, and postponed recommendations are kept here so you can review them later.</p>;
  return (
    <ol className="stack">
      {decided.map((r) => {
        const outcome = followUpOutcome(r, data.sessions, today);
        return (
          <li key={r.id} className="card" data-testid="rec-history-item">
            <div className="row between wrap">
              <span className="strong">{r.title}</span>
              <span className={`pill ${r.status === 'accepted' ? 'pill-completed' : r.status === 'rejected' ? 'pill-declined' : 'pill-new'}`}>{r.status}</span>
            </div>
            <span className="xs muted">
              {r.trigger} · decided {r.decidedAt ? shortDate(r.decidedAt.slice(0, 10)) : '—'}
              {r.status === 'postponed' && r.postponedUntil ? ` · back on ${shortDate(r.postponedUntil)}` : ''}
            </span>
            {r.appliedChange && <p className="diff">{describeChange(r.appliedChange)}</p>}
            {r.questions.some((q) => q.answer) && (
              <p className="xs muted">
                Your answers: {r.questions.filter((q) => q.answer).map((q) => `${q.text} ${q.answer}`).join(' · ')}
              </p>
            )}
            {outcome && <p className="small teal">Follow-up: {outcome}</p>}
          </li>
        );
      })}
    </ol>
  );
}
