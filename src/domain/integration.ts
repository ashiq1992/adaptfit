import { bodyweightTrend } from './bodyweight';
import { weekStartOf } from './progression';
import type { BodyweightEntry, CoachQuestion, CoachRecommendation, NutritionProfile, Profile, WeightUnit } from './types';

/**
 * Training ↔ nutrition coaching (V0.3). Rules are deterministic and phrased
 * as possibilities, never causes: AdaptFit does not record food intake, so it
 * cannot know why bodyweight or performance changed. Every suggestion needs
 * the user's approval; none lowers calories further on its own.
 */

export interface IntegrationContext {
  profile: Profile;
  nutrition: NutritionProfile | null;
  bodyweights: readonly BodyweightEntry[];
  today: string;
  /** From the weekly review: fewer sessions than planned are still possible this week? */
  behindThisWeek: boolean;
}

export interface IntegrationFinding {
  id: 'gain-stable' | 'loss-slow' | 'loss-fast' | 'busy-eating-out';
  title: string;
  trigger: string;
  explanation: string;
  supportingData: string[];
  missingData: string[];
  questions: CoachQuestion[];
  type: CoachRecommendation['type'];
  proposedChange: CoachRecommendation['proposedChange'];
}

const ACTIVE_STATUSES: NutritionProfile['status'][] = ['complete', 'in-progress'];

export function integrationFindings(ctx: IntegrationContext): IntegrationFinding[] {
  const out: IntegrationFinding[] = [];
  const n = ctx.nutrition && ACTIVE_STATUSES.includes(ctx.nutrition.status) ? ctx.nutrition : null;
  const unit: WeightUnit = ctx.profile.weightUnit;
  const trend = bodyweightTrend(ctx.bodyweights, unit);
  const goal = n?.goal ?? (ctx.profile.goal === 'hypertrophy' ? 'muscle-gain' : ctx.profile.goal === 'fat-loss' ? 'fat-loss' : null);
  const target = n?.target?.kcal ?? null;
  const missingCommon = ['AdaptFit does not record what you eat, so it cannot tell whether intake changed.'];

  // Situation A — muscle-gain goal, bodyweight stable.
  if (goal === 'muscle-gain' && trend.status === 'stable') {
    out.push({
      id: 'gain-stable',
      title: 'Review whether energy intake is adequate',
      trigger: 'Bodyweight stable on a muscle-gain goal',
      explanation:
        'Your bodyweight has been roughly stable while you train for muscle gain. That can mean intake is close to maintenance — but water, timing of weigh-ins, and recent routine changes also affect bodyweight. More information may be needed before changing anything.',
      supportingData: [trend.text],
      missingData: missingCommon,
      questions: [{ id: 'intake', text: 'Have you been eating less than usual, or skipping meals?', answer: null }],
      type: 'review-energy',
      proposedChange: target !== null ? { type: 'nutrition-target', fromKcal: target, toKcal: target + 150 } : { type: 'focus', text: 'Check whether your usual meals match your intended intake for two weeks before changing targets.' },
    });
  }

  // Situation D — fat-loss goal: consider longer-term trends; never escalate restriction automatically.
  if (goal === 'fat-loss' && trend.status === 'stable') {
    out.push({
      id: 'loss-slow',
      title: 'Keep the current target and review consistency',
      trigger: 'Bodyweight changing slowly on a fat-loss goal',
      explanation:
        'Bodyweight has changed little over several weeks. Rather than cutting calories further, AdaptFit suggests keeping your current target for another two weeks while checking that intake, steps, and training are consistent. Slow periods are common and short-term bodyweight is noisy.',
      supportingData: [trend.text],
      missingData: missingCommon,
      questions: [],
      type: 'keep-target',
      proposedChange: { type: 'focus', text: 'Keep the current calorie target; review weekly averages again in two weeks.' },
    });
  }
  if (goal === 'fat-loss' && trend.status === 'down' && trend.perWeek !== null) {
    const latestKg = ctx.bodyweights.length ? ctx.bodyweights[ctx.bodyweights.length - 1]! : null;
    const kg = latestKg ? (latestKg.unit === 'kg' ? latestKg.value : latestKg.value / 2.2046226218) : null;
    const perWeekKg = unit === 'kg' ? Math.abs(trend.perWeek) : Math.abs(trend.perWeek) / 2.2046226218;
    if (kg && perWeekKg > kg * 0.01) {
      out.push({
        id: 'loss-fast',
        title: 'Bodyweight is dropping quickly',
        trigger: 'Faster than ~1% of bodyweight per week',
        explanation:
          'Weekly averages are falling by more than about 1% of bodyweight per week. Fast loss can make training and recovery harder. Consider a slightly higher intake to protect performance — your choice.',
        supportingData: [trend.text],
        missingData: missingCommon,
        questions: [],
        type: 'review-energy',
        proposedChange: target !== null ? { type: 'nutrition-target', fromKcal: target, toKcal: target + 200 } : { type: 'focus', text: 'Consider eating a little more on training days.' },
      });
    }
  }

  // Situation C — busy week and mostly eating out.
  const overtime = ctx.profile.lifestyle.work?.overtime === 'often';
  const eatsOut = n?.habits.source === 'out' || n?.habits.source === 'mixed';
  if ((overtime || ctx.behindThisWeek) && eatsOut) {
    out.push({
      id: 'busy-eating-out',
      title: 'Busy week: keep it simple',
      trigger: overtime ? 'Frequent overtime and meals bought out' : 'Fewer sessions than planned and meals bought out',
      explanation:
        'When time is short, a reduced training week (Coach → Short on time this week) and convenient protein choices can keep progress going: extra chicken or egg at hawker stalls, fish soup, yong tau foo with tofu, unsweetened soy milk, or convenience-store eggs.',
      supportingData: [overtime ? 'You noted frequent overtime.' : 'This week has fewer completed sessions than planned.', `You usually ${n?.habits.source === 'out' ? 'eat out' : 'mix cooking and eating out'}.`],
      missingData: [],
      questions: [],
      type: 'convenient-protein',
      proposedChange: { type: 'focus', text: 'Use the adjusted-week planner if needed and pick one high-protein option per bought meal.' },
    });
  }
  return out;
}

export function integrationRecommendation(f: IntegrationFinding, id: string, now: Date, today: string): CoachRecommendation {
  return {
    id,
    createdAt: now.toISOString(),
    kind: 'nutrition',
    dedupeKey: `nutrition:${f.id}:${weekStartOf(today)}`,
    trigger: f.trigger,
    exerciseKey: null,
    supportingData: f.supportingData,
    missingData: f.missingData,
    questions: f.questions,
    type: f.type,
    title: f.title,
    explanation: f.explanation,
    proposedChange: f.proposedChange,
    status: 'open',
    decidedAt: null,
    postponedUntil: null,
    appliedChange: null,
    followUp: null,
  };
}

/** Apply an accepted nutrition-target change (pure). The user can edit it afterwards. */
export function applyNutritionChange(n: NutritionProfile, change: CoachRecommendation['appliedChange'], now: Date): NutritionProfile {
  if (!change || change.type !== 'nutrition-target' || !n.target) return n;
  return { ...n, target: { ...n.target, kcal: change.toKcal, source: 'manual', updatedAt: now.toISOString() }, updatedAt: now.toISOString() };
}
