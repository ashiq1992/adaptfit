/**
 * Core domain types for AdaptFit. Everything here is plain data so it can be
 * persisted in IndexedDB, exported to JSON, and validated with Zod.
 */

export const GOALS = ['strength', 'consistency', 'general'] as const;
export type Goal = (typeof GOALS)[number];

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Experience = (typeof EXPERIENCE_LEVELS)[number];

/** What the user tells us they have access to. Bodyweight is always available. */
export const EQUIPMENT_MODES = ['bodyweight', 'dumbbells', 'gym'] as const;
export type EquipmentMode = (typeof EQUIPMENT_MODES)[number];

/** Concrete items an exercise can require. */
export const EQUIPMENT_ITEMS = [
  'dumbbells',
  'bench',
  'barbell',
  'rack',
  'cable',
  'machine',
  'cardio-machine',
] as const;
export type EquipmentItem = (typeof EQUIPMENT_ITEMS)[number];

export const ENERGY_LEVELS = ['low', 'medium', 'high'] as const;
export type Energy = (typeof ENERGY_LEVELS)[number];

export const SORENESS_LEVELS = ['none', 'mild', 'high'] as const;
export type Soreness = (typeof SORENESS_LEVELS)[number];

/** Separate from ordinary soreness: any of these produce a rest state. */
export const SAFETY_CONCERNS = ['pain', 'illness', 'unsafe'] as const;
export type SafetyConcern = (typeof SAFETY_CONCERNS)[number];

export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export type ExerciseTag = 'strength' | 'endurance' | 'mobility';
export type Emphasis = 'upper' | 'lower' | 'full' | 'conditioning';
export type Intensity = 'gentle' | 'moderate' | 'hard';
export type ExerciseMode = 'reps' | 'timed';

/** Goals offered in V0.2. The quick-workout engine maps these onto template goal fit. */
export const TRAINING_GOALS = ['hypertrophy', 'strength', 'fat-loss', 'recomposition', 'general', 'consistency'] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

export type Level3 = 'low' | 'medium' | 'high';
export const TRAINING_WINDOWS = ['early', 'morning', 'lunch', 'evening', 'late'] as const;
export type TrainingWindow = (typeof TRAINING_WINDOWS)[number];
export const DIETARY_OPTIONS = ['halal', 'vegetarian', 'vegan', 'no-pork', 'no-beef', 'lactose-free', 'gluten-free'] as const;

/** Optional lifestyle context. AdaptFit must work with every section left empty. */
export interface Lifestyle {
  work: {
    days: number[]; // 0 = Sunday
    start: string | null; // HH:MM
    end: string | null;
    overtime: 'rare' | 'sometimes' | 'often' | null;
    trainingWindows: TrainingWindow[];
  } | null;
  sleep: {
    bedtime: string | null;
    wake: string | null;
    quality: 'poor' | 'fair' | 'good' | null;
  } | null;
  nutrition: {
    pattern: string;
    objective: 'maintain' | 'lean-gain' | 'fat-loss' | null;
    restrictions: string[];
    proteinTargetG: number | null;
    energyKcal: number | null;
    fasting: string | null;
  } | null;
  training: {
    minDays: number | null;
    preferredDays: number[];
  } | null;
}

export const EMPTY_LIFESTYLE: Lifestyle = { work: null, sleep: null, nutrition: null, training: null };

export interface Profile {
  id: 'me';
  goal: TrainingGoal;
  experience: Experience;
  equipment: EquipmentMode[];
  preferredMinutes: number;
  weightUnit: WeightUnit;
  /** IANA time zone for day boundaries and display. */
  timezone: string;
  /** Pixel-RPG layer. Workout features never depend on it. */
  gamification: boolean;
  lifestyle: Lifestyle;
  /** V0.3: cosmetic character choice. Never affects training logic or XP. */
  character: CharacterSelection;
  /** V0.3: answers from the guided programme questionnaire, reused next time. */
  trainingPrefs: TrainingPrefs;
  /** V0.4: weekly updates by default; 'live' shows set-by-set logging up front. */
  loggingMode: LoggingMode;
  /** V0.4: in-app prompts only (no push notifications). */
  notifications: NotificationPrefs;
  createdAt: string;
  updatedAt: string;
}

export interface CheckIn {
  /** Local calendar date, YYYY-MM-DD. One (latest) check-in per date. */
  localDate: string;
  availableMinutes: number;
  energy: Energy;
  soreness: Soreness;
  equipment: EquipmentMode[];
  safetyConcern: SafetyConcern | null;
  /** Optional recovery context — never required. */
  sleepHours: number | null;
  sleepQuality: 'poor' | 'fair' | 'good' | null;
  fatigue: Level3 | null;
  stress: Level3 | null;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  /** How load is recorded for this exercise by default. */
  loadType: LoadType;
  /** Lower-case alternative names used when importing notes. */
  aliases?: string[];
  tags: ExerciseTag[];
  equipment: EquipmentItem[];
  minExperience: Experience;
  /** 1 = easiest, 3 = hardest. */
  difficulty: 1 | 2 | 3;
  mode: ExerciseMode;
  /** Whether an external load can be recorded. */
  loadable: boolean;
  /** Seconds per rep for time estimates (reps mode). */
  secondsPerRep: number;
  defaultReps: number;
  defaultDurationSec: number;
  cue: string;
  /** Ordered list of safe substitutions by exercise ID. */
  substitutions: string[];
}

export interface TemplateBlock {
  exerciseId: string;
  sets: number;
  /** Prescribed reps (reps mode) — used when the exercise is reps-based. */
  reps?: number;
  /** Prescribed seconds (timed mode). */
  durationSec?: number;
  restSec: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  /** The equipment mode this template is written for. */
  mode: EquipmentMode;
  emphasis: Emphasis;
  intensity: Intensity;
  minExperience: Experience;
  /** 0–3 suitability for each goal. */
  goalFit: Record<Goal, number>;
  warmupSec: number;
  blocks: TemplateBlock[];
  /** Equipment that improves the template but is not required. */
  optionalEquipment: EquipmentItem[];
}

export interface PlanItem {
  /** Stable key for the slot within a plan (independent of swaps). */
  key: string;
  exerciseId: string;
  name: string;
  mode: ExerciseMode;
  tags: ExerciseTag[];
  loadable: boolean;
  equipment: EquipmentItem[];
  sets: number;
  reps: number | null;
  durationSec: number | null;
  restSec: number;
  cue: string;
  /** Present when the engine replaced the template exercise. */
  substitutedFrom: string | null;
}

export interface Plan {
  templateId: string;
  name: string;
  emphasis: Emphasis;
  intensity: Intensity;
  warmupSec: number;
  estimatedMinutes: number;
  equipment: EquipmentItem[];
  optionalEquipment: EquipmentItem[];
  items: PlanItem[];
}

export type ReasonCode =
  | 'safety-rest'
  | 'too-little-time'
  | 'time-band'
  | 'time-band-fallback'
  | 'low-energy'
  | 'high-soreness'
  | 'reduced-volume'
  | 'gentle-fallback'
  | 'high-energy'
  | 'equipment-substitution'
  | 'experience-substitution'
  | 'bodyweight-fallback'
  | 'recent-emphasis-avoided'
  | 'recent-emphasis-gentle'
  | 'goal-fit'
  | 'no-fitting-template';

export interface Reason {
  code: ReasonCode;
  label: string;
}

export interface RecommendationInputs {
  availableMinutes: number;
  timeBand: TimeBand | null;
  energy: Energy;
  soreness: Soreness;
  equipment: EquipmentMode[];
  experience: Experience;
  goal: Goal;
  recentEmphasis: Emphasis[];
}

export type Recommendation =
  | {
      kind: 'workout';
      plan: Plan;
      reasons: Reason[];
      rationale: string;
      inputs: RecommendationInputs;
    }
  | {
      kind: 'rest';
      cause: 'safety' | 'time' | 'no-fit';
      reasons: Reason[];
      rationale: string;
      inputs: RecommendationInputs;
    };

export type TimeBand = '5-14' | '15-29' | '30-60';


// ─────────────────────────────────────────────────────────────────────────
// V0.2 training model
// ─────────────────────────────────────────────────────────────────────────

/**
 * How a recorded load must be interpreted. Loads with different types are never
 * compared or summed, and Smith-machine or barbell bar weight is never assumed.
 */
export const LOAD_TYPES = ['total', 'per-side', 'per-dumbbell', 'bodyweight', 'bodyweight-plus', 'assisted', 'timed', 'unspecified'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

export interface CustomExercise {
  id: string;
  name: string;
  loadType: LoadType;
  tags: ExerciseTag[];
  createdAt: string;
}

export interface ProgrammeExercise {
  id: string;
  exerciseId: string;
  /** Display name snapshot (built-in or custom). */
  name: string;
  loadType: LoadType;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  durationSec: number | null;
  restSec: number;
  priority: boolean;
  notes: string;
  /**
   * V0.3: intended starting load, in its own unit and interpreted by loadType
   * (e.g. 30 kg per side). Optional. Actual loads are recorded per set.
   */
  plannedLoad: PlannedLoad | null;
  /**
   * V0.4: fields the note parser could not confirm (e.g. 'loadType' for
   * "Bench 30 kg"). Shown as needing attention; never silently resolved.
   */
  uncertain: NoteField[];
}

export interface PlannedLoad {
  value: number;
  unit: WeightUnit;
}

export interface ProgrammeDay {
  id: string;
  name: string;
  exercises: ProgrammeExercise[];
  /** V0.4: free text under the day that isn't an exercise. Always preserved verbatim. */
  notes: string;
}

export interface Programme {
  id: string;
  name: string;
  goal: TrainingGoal;
  days: ProgrammeDay[];
  daysPerWeek: number;
  /** Preferred weekdays, 0 = Sunday. */
  preferredWeekdays: number[];
  isActive: boolean;
  source: 'created' | 'imported' | 'starter' | 'restored' | 'template';
  /** V0.3: the AdaptFit template this programme was generated from, if any. */
  templateId: string | null;
  /** V0.4: free text at the top of the workout note. */
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSet {
  id: string;
  /** Load in the exercise's unit, interpreted by its loadType. null = not recorded. */
  load: number | null;
  reps: number | null;
  durationSec: number | null;
  /** Optional reps in reserve. */
  rir: number | null;
  /** Only explicitly confirmed sets count. Prefilled values are never completed. */
  completed: boolean;
  completedAt: string | null;
  prefill: 'previous' | 'planned' | 'target' | 'none';
}

export interface SessionExercise {
  key: string;
  exerciseId: string;
  name: string;
  loadType: LoadType;
  unit: WeightUnit;
  tags: ExerciseTag[];
  priority: boolean;
  target: { sets: number; repMin: number | null; repMax: number | null; durationSec: number | null; restSec: number };
  skipped: boolean;
  notes: string;
  sets: SessionSet[];
}

export type SessionState = 'active' | 'completed' | 'discarded';

/**
 * How a session's duration is known:
 * - timer: start→finish minus pauses, logged live and confirmed by the user.
 * - manual: entered by the user.
 * - not-recorded: unknown (imports, retrospective logging).
 * - legacy-entry-time: V0.1 record; start→finish reflects data entry, not training.
 */
export type DurationSource = 'timer' | 'manual' | 'not-recorded' | 'legacy-entry-time';

export interface Substitution {
  itemKey: string;
  fromExerciseId: string;
  fromName: string;
  toExerciseId: string;
  toName: string;
  at: string;
}

export interface WorkoutSession {
  id: string;
  schemaVersion: 3;
  state: SessionState;
  /** 'weekly' = generated from a confirmed weekly update (V0.4). */
  source: 'programme' | 'quick' | 'import' | 'manual' | 'legacy' | 'weekly';
  name: string;
  programmeId: string | null;
  dayId: string | null;
  /** How the plan for this session was arrived at. */
  planKind: 'programme-day' | 'shortened' | 'adjusted-week' | 'quick' | 'import' | 'legacy' | 'weekly';
  emphasis: Emphasis | null;
  checkIn: CheckIn | null;
  exercises: SessionExercise[];
  position: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedLocalDate: string | null;
  discardedAt: string | null;
  /** Workout timer state; paused intervals are excluded from active time. */
  pausedAt: string | null;
  pausedMs: number;
  durationSource: DurationSource;
  /** Recorded training duration in seconds; null when unavailable. */
  durationSec: number | null;
  restStartedAt: string | null;
  restDurationSec: number | null;
  substitutions: Substitution[];
  /** Hash of imported source text — used to reject duplicate imports. */
  importHash: string | null;
  editedAt: string | null;
}

export interface Measurement {
  id: string;
  localDate: string;
  bodyweightKg: number | null;
  waistCm: number | null;
  note: string;
  createdAt: string;
}

/** A proposed change to a programme. Applied only after explicit user approval. */
export type ProgrammeChange =
  | { type: 'rep-range'; programmeId: string; dayId: string; programmeExerciseId: string; name: string; from: [number | null, number | null]; to: [number | null, number | null] }
  | { type: 'sets'; programmeId: string; dayId: string; programmeExerciseId: string; name: string; from: number; to: number }
  | { type: 'focus'; text: string }
  | { type: 'nutrition-target'; fromKcal: number | null; toKcal: number };

export type CoachRecType =
  | 'continue'
  | 'review-recovery'
  | 'check-consistency'
  | 'small-progression'
  | 'reorganise-schedule'
  | 'planned-reduction'
  | 'seek-advice'
  | 'review-energy'
  | 'keep-target'
  | 'convenient-protein';

export type CoachQuestionId = 'sleep' | 'harder' | 'food' | 'missed' | 'fatigue' | 'intake' | 'busy';

export interface CoachQuestion {
  id: CoachQuestionId;
  text: string;
  answer: 'yes' | 'no' | 'unsure' | null;
}

export interface CoachRecommendation {
  id: string;
  createdAt: string;
  kind: 'plateau' | 'weekly' | 'schedule' | 'nutrition';
  /** Stable key so the same finding isn't raised twice. */
  dedupeKey: string;
  trigger: string;
  exerciseKey: string | null;
  supportingData: string[];
  missingData: string[];
  questions: CoachQuestion[];
  type: CoachRecType;
  title: string;
  explanation: string;
  proposedChange: ProgrammeChange | null;
  status: 'open' | 'accepted' | 'rejected' | 'postponed';
  decidedAt: string | null;
  postponedUntil: string | null;
  appliedChange: ProgrammeChange | null;
  followUp: { dueDate: string; outcome: string | null } | null;
}

export interface WeekPlanSession {
  dayId: string;
  name: string;
  added: { programmeExerciseId: string; name: string; sets: number; fromDay: string }[];
  estimatedMinutes: number;
}

export interface WeekPlan {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  programmeId: string;
  plannedSessions: number;
  availableSessions: number;
  sessions: WeekPlanSession[];
  tradeoffs: string[];
  status: 'pending' | 'approved' | 'rejected';
  decidedAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// V0.3: guided training, bodyweight, AdaptFit Fuel, characters
// ─────────────────────────────────────────────────────────────────────────

/** Equipment access options in the guided questionnaire. */
export const EQUIPMENT_ACCESS = ['full-gym', 'dumbbells-bench', 'basic-home', 'bodyweight'] as const;
export type EquipmentAccess = (typeof EQUIPMENT_ACCESS)[number];

export const MUSCLE_PRIORITIES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'full-body'] as const;
export type MusclePriority = (typeof MUSCLE_PRIORITIES)[number];

export const SESSION_LENGTHS = [30, 45, 60, 75, 90] as const;

export interface TrainingPrefs {
  equipmentAccess: EquipmentAccess | null;
  priorities: MusclePriority[];
  /** Library exercise IDs the user prefers not to do. */
  avoidExerciseIds: string[];
  /** Free-text note (e.g. "no overhead pressing"); stored, never interpreted as medical info. */
  restrictionNote: string;
  /** Days a week the user said they can realistically train (reused by the questionnaire). */
  daysPerWeek: number | null;
}

export const EMPTY_TRAINING_PREFS: TrainingPrefs = { equipmentAccess: null, priorities: [], avoidExerciseIds: [], restrictionNote: '', daysPerWeek: null };

export const CHARACTER_STYLES = ['warrior', 'ranger', 'scholar', 'engineer'] as const;
export type CharacterStyle = (typeof CHARACTER_STYLES)[number];

export interface CharacterSelection {
  /** Unknown or removed styles fall back to the default sprite. */
  style: string;
  /** Alternate palette ID; null = the style's default. Reserved for future unlocks. */
  palette: string | null;
  /** Unlocked layers the user chose to hide (e.g. "cape"). */
  hiddenLayers: string[];
  updatedAt: string | null;
}

export const DEFAULT_CHARACTER: CharacterSelection = { style: 'warrior', palette: null, hiddenLayers: [], updatedAt: null };

/** A personal bodyweight record. Separate from lifted loads. */
export interface BodyweightEntry {
  id: string;
  localDate: string;
  /** Value in `unit`, exactly as entered. */
  value: number;
  unit: WeightUnit;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export const ACTIVITY_LEVELS = ['mostly-seated', 'lightly-active', 'active', 'very-active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const MEAL_SOURCES = ['home', 'out', 'mixed'] as const;
export type MealSource = (typeof MEAL_SOURCES)[number];

export const CUISINES = ['malay', 'chinese', 'indian', 'mediterranean', 'western', 'japanese', 'korean', 'thai', 'other'] as const;
export type Cuisine = (typeof CUISINES)[number];

/** Dietary requirements used as hard filters on meal suggestions. */
export const DIET_FLAGS = ['halal', 'vegetarian', 'vegan', 'no-pork', 'no-beef', 'no-alcohol'] as const;
export type DietFlag = (typeof DIET_FLAGS)[number];

/** Allergens and intolerances tracked in food metadata. */
export const ALLERGENS = ['peanut', 'tree-nut', 'egg', 'dairy', 'soy', 'gluten', 'fish', 'shellfish', 'sesame'] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const NUTRITION_GOALS = ['maintain', 'muscle-gain', 'fat-loss', 'recomposition'] as const;
export type NutritionGoal = (typeof NUTRITION_GOALS)[number];

export interface NutritionTarget {
  kcal: number | null;
  proteinG: [number, number] | null;
  carbsG: number | null;
  fatG: number | null;
  /** 'estimate' = from the energy engine; 'manual' = set or edited by the user. */
  source: 'estimate' | 'manual';
  updatedAt: string;
}

export interface NutritionSafety {
  under18: boolean;
  pregnantOrBreastfeeding: boolean;
  eatingDisorderHistory: boolean;
  medicalCondition: boolean;
}

export interface EatingHabits {
  source: MealSource | null;
  /** For mixed eaters: which meals are usually cooked at home. */
  cookedSlots: MealSlot[];
  mealsPerDay: number | null;
  eatingTimes: string;
  budgetPerMealSgd: number | null;
  cookingMinutes: number | null;
  kitchen: string[];
}

/**
 * AdaptFit Fuel profile. Every field is optional; the setup is resumable and
 * skippable. Nothing here is required to train.
 */
export interface NutritionProfile {
  id: 'me';
  status: 'not-asked' | 'declined' | 'in-progress' | 'complete';
  step: number;
  ageYears: number | null;
  heightCm: number | null;
  /** Equation input for Mifflin–St Jeor; 'unspecified' = use manual targets. */
  equationSex: 'male' | 'female' | 'unspecified';
  activity: ActivityLevel | null;
  avgSteps: number | null;
  physicalWork: boolean | null;
  knownMaintenanceKcal: number | null;
  goal: NutritionGoal | null;
  safety: NutritionSafety;
  target: NutritionTarget | null;
  habits: EatingHabits;
  cuisines: Cuisine[];
  diet: DietFlag[];
  allergens: Allergen[];
  intolerances: Allergen[];
  dislikes: string[];
  exclusions: string[];
  fasting: string | null;
  favourites: string[];
  updatedAt: string;
}

export interface MealPlanItem {
  slot: MealSlot;
  mealId: string;
  mode: 'cook' | 'buy';
  /** Portion multiplier (0.5–2). */
  portion: number;
}

/** The daily suggestion and the user's swaps, kept per date. */
export interface MealPlan {
  localDate: string;
  items: MealPlanItem[];
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// V0.4: notes-first workouts, weekly updates, imports
// ─────────────────────────────────────────────────────────────────────────

export const LOGGING_MODES = ['weekly', 'live'] as const;
export type LoggingMode = (typeof LOGGING_MODES)[number];

export interface NotificationPrefs {
  /** Show the "Update this week" reminder on Plan near the end of a week. */
  weeklyReminder: boolean;
  /** Show a dot on Coach when there is a new finding. */
  coachFindings: boolean;
}

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = { weeklyReminder: true, coachFindings: true };

/** Structured fields a note line can leave unconfirmed. */
export const NOTE_FIELDS = ['exercise', 'loadType', 'unit', 'sets', 'reps'] as const;
export type NoteField = (typeof NOTE_FIELDS)[number];

/** One recorded set in a weekly update. */
export interface PerformanceSet {
  load: number | null;
  reps: number | null;
  durationSec: number | null;
}

/**
 * Where a weekly value came from. Copied or planned values are only a starting
 * point: they count as performance only after the session is confirmed.
 */
export type PerformanceSource = 'copied' | 'edited' | 'planned' | 'imported' | 'live' | 'blank';

/** One exercise's performance within a weekly session record. */
export interface ExercisePerformance {
  programmeExerciseId: string | null;
  exerciseId: string;
  name: string;
  loadType: LoadType;
  unit: WeightUnit;
  /** What the user sees and edits, e.g. "30 kg/side × 9, 8, 8". */
  text: string;
  /** Parsed from `text`; empty when nothing usable was entered. */
  sets: PerformanceSet[];
  /** 'skipped' rows are never recorded; 'done' rows are recorded once the session is confirmed. */
  status: 'done' | 'skipped';
  source: PerformanceSource;
  /** The reference this value was copied from, kept for change highlighting. */
  previous: { weekStart: string | null; text: string; sets: PerformanceSet[] } | null;
  uncertain: NoteField[];
}

export const WEEKLY_SESSION_STATUSES = ['completed', 'partial', 'skipped', 'not-recorded'] as const;
export type WeeklySessionStatus = (typeof WEEKLY_SESSION_STATUSES)[number];

export interface WeeklySessionRecord {
  /** Stable within the week (day ID, or a generated ID for an extra session). */
  id: string;
  dayId: string | null;
  name: string;
  /** Date the session was done; required to count as completed. */
  localDate: string | null;
  status: WeeklySessionStatus;
  /** The workout record that represents this session (generated on confirm, or a live-logged one). */
  sessionId: string | null;
  /** True when this session was logged set by set; its values come from that log. */
  live: boolean;
  exercises: ExercisePerformance[];
  note: string;
}

/** A training week: a draft until confirmed, then a historical record. */
export interface TrainingWeek {
  /** Monday, YYYY-MM-DD. One record per week. */
  weekStart: string;
  programmeId: string | null;
  status: 'draft' | 'confirmed';
  sessions: WeeklySessionRecord[];
  /** Week the values were copied from, if any. */
  copiedFrom: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  /** Increments on every confirmation; earlier confirmed versions are kept in `history`. */
  revision: number;
  reviewDismissed: boolean;
  history: { revision: number; confirmedAt: string; sessions: WeeklySessionRecord[] }[];
}

/** Snapshot of a workout note before an edit, used for undo and recovery. */
export interface NoteRevision {
  id: string;
  programmeId: string;
  at: string;
  reason: string;
  snapshot: Programme;
}

/** Performance from a pasted note the user marked as undated. Never used for trends. */
export interface UndatedPerformance {
  exerciseId: string;
  name: string;
  loadType: LoadType;
  unit: WeightUnit;
  sets: PerformanceSet[];
}

export interface WorkoutImportRecord {
  id: string;
  /** Hash of the normalised pasted text, for duplicate detection. */
  hash: string;
  mode: 'template' | 'history' | 'week';
  createdAt: string;
  /** Date given for a historical import; null when imported as undated. */
  localDate: string | null;
  text: string;
  /** IDs of records created (programme, sessions, or week). */
  resultIds: string[];
  undated: UndatedPerformance[];
}
