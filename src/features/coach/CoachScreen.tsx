import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { addRecommendation, decideRecommendation, newId, saveRecommendation, saveWeekPlan, setReviewDismissed } from '../../data/repo';
import { answerQuestion, followUpOutcome, newPlateauRecommendation, weeklyReview } from '../../domain/coach';
import { addDays } from '../../domain/dates';
import { allExerciseStatuses } from '../../domain/performance';
import { detectPlateaus } from '../../domain/plateau';
import { nextDay } from '../../domain/programme';
import { weekStartOf } from '../../domain/progression';
import { bodyweightTrend } from '../../domain/bodyweight';
import { integrationFindings, integrationRecommendation } from '../../domain/integration';
import { plural, proposeWeek, suggestedAvailability, weekSchedule } from '../../domain/schedule';
import type { CoachQuestion, CoachRecommendation, ProgrammeChange, WeekPlan } from '../../domain/types';
import { priorityKeys } from '../../data/useAppData';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { Tabs } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { navigate } from '../../ui/hooks';
import { IconCheck, IconInfo, IconMinus, IconPlus } from '../../ui/icons';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { shortDate, weekLabel } from '../format';
import { useWeekReview, WeekReviewCard } from '../weekly/WeekReview';

/** Automatic plateau recommendations per week. */
const MAX_AUTO_RECOMMENDATIONS = 2;

const FuelScreen = lazy(() => import('../fuel/FuelScreen').then((m) => ({ default: m.FuelScreen })));

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'history', label: 'Decisions' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Coach: a short, evidence-based summary first. Tabs are part of the URL (#/coach/fuel). */
export function CoachScreen({ tab: routeTab }: { tab: string | null }) {
  const tab: TabId = TABS.some((t) => t.id === routeTab) ? (routeTab as TabId) : 'summary';
  const setTab = (t: TabId) => navigate(t === 'summary' ? '/coach' : `/coach/${t}`);
  return (
    <div className="screen">
      <ScreenHeader title="Coach" subtitle="Useful feedback only when your records support it." settings />
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Coach views" idBase="coach" />
      <div id="coach-panel" role="tabpanel" aria-labelledby={`coach-tab-${tab}`} className="stack">
        {tab === 'summary' && <Summary />}
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

function Summary() {
  const { data, today } = useApp();
  const latest = [...data.trainingWeeks].filter((w) => w.status === 'confirmed').sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0] ?? null;
  const review = useWeekReview(latest);
  const [showReview, setShowReview] = useState(false);
  const findings = useMemo(
    () => detectPlateaus(data.sessions, today, { checkIns: data.checkIns, profile: data.profile, priorityKeys: priorityKeys(data.activeProgramme) }),
    [data.sessions, data.checkIns, data.profile, data.activeProgramme, today],
  );
  const statuses = useMemo(() => allExerciseStatuses(data.sessions, today, { checkIns: data.checkIns, profile: data.profile }), [data.sessions, data.checkIns, data.profile, today]);
  const painReports = data.checkIns.filter((c) => c.safetyConcern === 'pain' && c.localDate >= addDays(today, -28)).length;

  // Raise suggestions automatically only for priority lifts (or any, if none are marked), at most two a week.
  const prio = priorityKeys(data.activeProgramme);
  const plateaus = findings.filter((f) => f.status === 'possible-plateau');
  const auto = (prio.size ? plateaus.filter((f) => prio.has(f.key)) : plateaus).slice(0, MAX_AUTO_RECOMMENDATIONS);
  const raise = (f: (typeof findings)[number]) => addRecommendation(newPlateauRecommendation({ id: newId(), now: clock.now(), today, finding: f, programme: data.activeProgramme, recentPainReports: painReports }));
  const autoKeys = auto.map((f) => f.key).join('|');
  useEffect(() => {
    for (const f of auto) void raise(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKeys, today]);

  // Training + nutrition context, only when relevant (and only if Fuel or bodyweight data exists).
  const legacyReview = useMemo(() => weeklyReview({ sessions: data.sessions, programme: data.activeProgramme, weekPlans: data.weekPlans, checkIns: data.checkIns, today }), [data, today]);
  const nutritionFindings = useMemo(
    () => integrationFindings({ profile: data.profile, nutrition: data.nutrition, bodyweights: data.bodyweights, today, behindThisWeek: legacyReview.status === 'behind' }),
    [data.profile, data.nutrition, data.bodyweights, today, legacyReview.status],
  );
  const nutritionKeys = nutritionFindings.map((f) => f.id).join('|');
  useEffect(() => {
    for (const f of nutritionFindings) void addRecommendation(integrationRecommendation(f, newId(), clock.now(), today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nutritionKeys, today]);

  const raisedKeys = new Set(data.recommendations.filter((r) => r.kind === 'plateau' && r.dedupeKey.endsWith(weekStartOf(today))).map((r) => r.exerciseKey));
  const watching = plateaus.filter((f) => !raisedKeys.has(f.key));
  const declines = statuses.filter((s) => s.status === 'possible-decline');
  const active = data.recommendations.filter((r) => r.status === 'open' || (r.status === 'postponed' && (r.postponedUntil ?? '') <= today));
  const judged = statuses.filter((s) => s.status !== 'insufficient-data').length;
  const insufficient = statuses.length - judged;

  return (
    <>
      {latest && review && (!latest.reviewDismissed || showReview) ? (
        <WeekReviewCard
          week={latest}
          review={review}
          actions={
            <div className="row wrap">
              <button type="button" className="btn btn-tertiary btn-sm" onClick={() => void setReviewDismissed(latest.weekStart, true).then(() => setShowReview(false))}>
                Dismiss
              </button>
              <a href={`#/week/${latest.weekStart}`} className="btn btn-ghost btn-sm">
                Open week
              </a>
            </div>
          }
        />
      ) : latest ? (
        <button type="button" className="link-btn" onClick={() => setShowReview(true)} data-testid="show-review">
          Show the review for the {weekLabel(latest.weekStart).toLowerCase()}
        </button>
      ) : (
        <section className="card" data-testid="no-review">
          <h2 className="card-title">No weekly review yet</h2>
          <p className="small muted">Your first review appears after you confirm a weekly update. It compares each exercise with your previous record — nothing is assumed.</p>
          <a href="#/week" className="btn btn-secondary">
            Update this week
          </a>
        </section>
      )}

      {active.map((r) => (
        <RecommendationCard key={r.id} rec={r} painReports={painReports} />
      ))}

      {(watching.length > 0 || declines.length > 0) && (
        <section className="card" data-testid="watch-list" aria-labelledby="watch-title">
          <h2 id="watch-title" className="card-title">
            May need attention
          </h2>
          <ul className="change-rows">
            {declines.map((s) => (
              <li key={s.key} className="block">
                <span className="small strong">{s.name}</span>
                <span className="xs muted block">{s.reason}</span>
              </li>
            ))}
            {watching.map((f) => (
              <li key={f.key}>
                <span className="small">
                  <span className="strong">{f.name}</span> <span className="muted">· possible plateau</span>
                </span>
                <button type="button" className="btn btn-tertiary btn-sm" onClick={() => void raise(f)}>
                  Get suggestion
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active.length === 0 && watching.length === 0 && declines.length === 0 && (
        <div className={`status-banner ${judged === 0 ? 'amber' : ''}`} data-testid={judged === 0 ? 'insufficient-banner' : 'no-plateau'}>
          {judged === 0 ? <IconInfo /> : <IconCheck />}
          <div>
            <span className="strong">{judged === 0 ? 'Not enough data to judge yet' : 'Nothing needs changing'}</span>
            <p className="small muted">
              {judged === 0
                ? statuses.length
                  ? `None of your ${statuses.length} exercises has two comparable records yet. Keep updating each week.`
                  : 'Confirm a weekly update or two first.'
                : `Based on ${judged} exercise${judged === 1 ? '' : 's'} with enough history; no plateau or decline.${insufficient ? ` ${insufficient} more can't be judged yet.` : ''}`}
            </p>
          </div>
        </div>
      )}

      <details className="card disclosure">
        <summary className="card-title">Short on time this week?</summary>
        <WeekPlanner />
      </details>

      <section className="card" aria-labelledby="life-title">
        <h2 id="life-title" className="card-title">
          Recovery and nutrition (optional)
        </h2>
        <NutritionLine />
        <div className="row wrap">
          <a href="#/coach/fuel" className="btn btn-tertiary btn-sm">
            AdaptFit Fuel
          </a>
          <a href="#/settings" className="btn btn-ghost btn-sm">
            Sleep and work schedule
          </a>
        </div>
      </section>
    </>
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
        <a href="#/plan" className="btn btn-secondary">
          Go to Plan
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
    announce(status === 'approved' ? 'Adjusted week approved. This week’s update will list these sessions.' : 'Proposal rejected. Your normal programme continues.');
  };

  return (
    <div className="stack-sm" aria-label="Plan this week">
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
          {hint && <p className="xs muted">{hint.reason}</p>}
          <div className="row" role="group" aria-label="Sessions available this week">
            <button type="button" className="step-btn" aria-label="Fewer sessions" onClick={() => setAvailable((v) => Math.max(0, v - 1))}>
              <IconMinus />
            </button>
            <span className="metric-val num count-val" aria-live="polite" data-testid="available-sessions">
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
                  <span key={a.programmeExerciseId} className="xs block">
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
    </div>
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
        <span className={`pill ${rec.kind === 'nutrition' ? 'pill-mission' : 'pill-attention'}`}>{rec.kind === 'nutrition' ? 'Training + nutrition' : 'Possible plateau'}</span>
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
            {outcome && <p className="small">Follow-up: {outcome}</p>}
          </li>
        );
      })}
    </ol>
  );
}
