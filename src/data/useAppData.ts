import { localDateOf } from '../domain/dates';
import { comparableKey } from '../domain/loads';
import { dedupeSessions } from '../domain/weekly';
import type {
  BodyweightEntry,
  CheckIn,
  CoachRecommendation,
  CustomExercise,
  Measurement,
  MealPlan,
  NutritionProfile,
  Profile,
  Programme,
  TrainingWeek,
  WeekPlan,
  WorkoutImportRecord,
  WorkoutSession,
} from '../domain/types';
import { clock } from '../ui/clock';
import { useLive, useNow } from '../ui/hooks';
import { getDb } from './db';

export interface AppData {
  profile: Profile | undefined;
  programmes: Programme[];
  activeProgramme: Programme | null;
  sessions: WorkoutSession[];
  completed: WorkoutSession[];
  active: WorkoutSession | undefined;
  checkIns: CheckIn[];
  recommendations: CoachRecommendation[];
  weekPlans: WeekPlan[];
  measurements: Measurement[];
  customExercises: CustomExercise[];
  reviewedWeeks: string[];
  bodyweights: BodyweightEntry[];
  nutrition: NutritionProfile | null;
  mealPlans: MealPlan[];
  /** V0.4 weekly records, oldest first. */
  trainingWeeks: TrainingWeek[];
  imports: WorkoutImportRecord[];
}

async function loadAll(): Promise<AppData> {
  const db = getDb();
  const [profile, programmes, stored, checkIns, recommendations, weekPlans, measurements, customExercises, reviewed, bodyweights, nutrition, mealPlans, trainingWeeks, imports] = await Promise.all([
    db.profile.get('me'),
    db.programmes.toArray(),
    db.sessions.toArray(),
    db.checkIns.toArray(),
    db.recommendations.toArray(),
    db.weekPlans.toArray(),
    db.measurements.toArray(),
    db.customExercises.toArray(),
    db.meta.get('reviewedWeeks'),
    db.bodyweights.toArray(),
    db.nutrition.get('me'),
    db.mealPlans.toArray(),
    db.trainingWeeks.orderBy('weekStart').toArray(),
    db.imports.toArray(),
  ]);
  // A workout logged live and also entered in a weekly update counts once.
  const sessions = dedupeSessions(stored);
  const completed = sessions
    .filter((s) => s.state === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.id.localeCompare(b.id));
  return {
    profile,
    programmes: programmes.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    activeProgramme: programmes.find((p) => p.isActive) ?? null,
    sessions,
    completed,
    active: sessions.find((s) => s.state === 'active'),
    checkIns: checkIns.sort((a, b) => a.localDate.localeCompare(b.localDate)),
    recommendations: recommendations.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    weekPlans,
    measurements: measurements.sort((a, b) => a.localDate.localeCompare(b.localDate)),
    customExercises,
    reviewedWeeks: (reviewed?.value as string[] | undefined) ?? [],
    bodyweights: bodyweights.sort((a, b) => a.localDate.localeCompare(b.localDate) || a.createdAt.localeCompare(b.createdAt)),
    nutrition: nutrition ?? null,
    mealPlans,
    trainingWeeks,
    imports,
  };
}

/**
 * Every screen reads from this single live snapshot. Dexie re-runs the query
 * on any change (including from other tabs), so all derived numbers — trends,
 * personal bests, reviews — recalculate from the stored records.
 */
export function useAppData() {
  return useLive(loadAll, []);
}

export function useToday(profile: Profile | undefined): string {
  const now = useNow(30_000);
  return localDateOf(now, profile?.timezone);
}

export function priorityKeys(programme: Programme | null): Set<string> {
  const keys = new Set<string>();
  programme?.days.forEach((d) => d.exercises.forEach((e) => e.priority && keys.add(comparableKey(e.exerciseId, e.loadType))));
  return keys;
}

export const nowDate = () => clock.now();
