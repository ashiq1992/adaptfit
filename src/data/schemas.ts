import { z } from 'zod';
import { isLocalDate } from '../domain/dates';
import { MAX_DURATION_SEC, MAX_LOAD, MAX_REPS } from '../domain/logging';
import {
  ACTIVITY_LEVELS,
  ALLERGENS,
  CUISINES,
  DIET_FLAGS,
  EQUIPMENT_ACCESS,
  MEAL_SLOTS,
  MEAL_SOURCES,
  MUSCLE_PRIORITIES,
  NUTRITION_GOALS,
  ENERGY_LEVELS,
  EQUIPMENT_ITEMS,
  EQUIPMENT_MODES,
  EXPERIENCE_LEVELS,
  GOALS,
  LOAD_TYPES,
  SAFETY_CONCERNS,
  SORENESS_LEVELS,
  TRAINING_GOALS,
  TRAINING_WINDOWS,
  WEIGHT_UNITS,
} from '../domain/types';

const isoInstant = z.iso.datetime();
const localDate = z.string().refine(isLocalDate, 'Expected a YYYY-MM-DD date');
const id = z.string().min(1).max(120);
const shortText = z.string().max(200);
const longText = z.string().max(2000);
const equipmentModes = z.array(z.enum(EQUIPMENT_MODES)).max(EQUIPMENT_MODES.length);
const tags = z.array(z.enum(['strength', 'endurance', 'mobility'])).max(3);
const level3 = z.enum(['low', 'medium', 'high']);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekday = z.number().int().min(0).max(6);

// ── V0.1 (backup format 1) ─────────────────────────────────────────

export const legacyProfileSchema = z.object({
  id: z.literal('me'),
  goal: z.enum(GOALS),
  experience: z.enum(EXPERIENCE_LEVELS),
  equipment: equipmentModes,
  preferredMinutes: z.number().int().min(5).max(60),
  weightUnit: z.enum(WEIGHT_UNITS),
  createdAt: isoInstant,
  updatedAt: isoInstant,
});

export const legacyCheckInSchema = z.object({
  localDate,
  availableMinutes: z.number().int().min(0).max(240),
  energy: z.enum(ENERGY_LEVELS),
  soreness: z.enum(SORENESS_LEVELS),
  equipment: equipmentModes,
  safetyConcern: z.enum(SAFETY_CONCERNS).nullable(),
  updatedAt: isoInstant,
});

export const planItemSchema = z.object({
  key: id,
  exerciseId: id,
  name: shortText,
  mode: z.enum(['reps', 'timed']),
  tags,
  loadable: z.boolean(),
  equipment: z.array(z.enum(EQUIPMENT_ITEMS)).max(EQUIPMENT_ITEMS.length),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(MAX_REPS).nullable(),
  durationSec: z.number().int().min(1).max(MAX_DURATION_SEC).nullable(),
  restSec: z.number().int().min(0).max(900),
  cue: z.string().max(500),
  substitutedFrom: id.nullable(),
});

export const planSchema = z.object({
  templateId: id,
  name: shortText,
  emphasis: z.enum(['upper', 'lower', 'full', 'conditioning']),
  intensity: z.enum(['gentle', 'moderate', 'hard']),
  warmupSec: z.number().int().min(0).max(1800),
  estimatedMinutes: z.number().int().min(0).max(240),
  equipment: z.array(z.enum(EQUIPMENT_ITEMS)).max(EQUIPMENT_ITEMS.length),
  optionalEquipment: z.array(z.enum(EQUIPMENT_ITEMS)).max(EQUIPMENT_ITEMS.length),
  items: z.array(planItemSchema).min(1).max(30),
});

export const substitutionSchema = z.object({
  itemKey: id,
  fromExerciseId: id,
  fromName: shortText,
  toExerciseId: id,
  toName: shortText,
  at: isoInstant,
});

export const legacySessionSchema = z.object({
  id,
  state: z.enum(['active', 'completed', 'discarded']),
  startedAt: isoInstant,
  updatedAt: isoInstant,
  completedAt: isoInstant.nullable(),
  completedLocalDate: localDate.nullable(),
  discardedAt: isoInstant.nullable(),
  checkIn: legacyCheckInSchema,
  recommendedPlan: planSchema,
  plan: planSchema,
  substitutions: z.array(substitutionSchema).max(100),
  sets: z
    .array(
      z.object({
        id,
        itemKey: id,
        exerciseId: id,
        exerciseName: shortText,
        tags,
        reps: z.number().int().min(1).max(MAX_REPS).nullable(),
        durationSec: z.number().int().min(1).max(MAX_DURATION_SEC).nullable(),
        load: z.object({ value: z.number().finite().min(0).max(MAX_LOAD), unit: z.enum(WEIGHT_UNITS) }).nullable(),
        loggedAt: isoInstant,
        updatedAt: isoInstant,
      }),
    )
    .max(500),
  position: z.number().int().min(0),
  restStartedAt: isoInstant.nullable(),
  restDurationSec: z.number().int().min(0).max(900).nullable(),
});

// ── V0.2 (backup format 2) ─────────────────────────────────────────

export const lifestyleSchema = z.object({
  work: z
    .object({
      days: z.array(weekday).max(7),
      start: hhmm.nullable(),
      end: hhmm.nullable(),
      overtime: z.enum(['rare', 'sometimes', 'often']).nullable(),
      trainingWindows: z.array(z.enum(TRAINING_WINDOWS)).max(TRAINING_WINDOWS.length),
    })
    .nullable(),
  sleep: z.object({ bedtime: hhmm.nullable(), wake: hhmm.nullable(), quality: z.enum(['poor', 'fair', 'good']).nullable() }).nullable(),
  nutrition: z
    .object({
      pattern: shortText,
      objective: z.enum(['maintain', 'lean-gain', 'fat-loss']).nullable(),
      restrictions: z.array(z.string().max(40)).max(20),
      proteinTargetG: z.number().int().min(0).max(500).nullable(),
      energyKcal: z.number().int().min(0).max(10000).nullable(),
      fasting: shortText.nullable(),
    })
    .nullable(),
  training: z.object({ minDays: z.number().int().min(0).max(7).nullable(), preferredDays: z.array(weekday).max(7) }).nullable(),
});

export const profileSchemaV2 = z.object({
  id: z.literal('me'),
  goal: z.enum(TRAINING_GOALS),
  experience: z.enum(EXPERIENCE_LEVELS),
  equipment: equipmentModes,
  preferredMinutes: z.number().int().min(5).max(180),
  weightUnit: z.enum(WEIGHT_UNITS),
  timezone: z.string().min(1).max(64),
  gamification: z.boolean(),
  lifestyle: lifestyleSchema,
  createdAt: isoInstant,
  updatedAt: isoInstant,
});

// ── V0.3 (backup format 3) ─────────────────────────────────────────

export const characterSchema = z.object({
  // Any short ID is accepted so a removed style can't make a backup unreadable; unknown styles render the default sprite.
  style: z.string().min(1).max(40),
  palette: z.string().max(40).nullable(),
  hiddenLayers: z.array(z.string().max(40)).max(20),
  updatedAt: isoInstant.nullable(),
});

export const trainingPrefsSchema = z.object({
  equipmentAccess: z.enum(EQUIPMENT_ACCESS).nullable(),
  priorities: z.array(z.enum(MUSCLE_PRIORITIES)).max(MUSCLE_PRIORITIES.length),
  avoidExerciseIds: z.array(id).max(100),
  restrictionNote: z.string().max(500),
  daysPerWeek: z.number().int().min(1).max(7).nullable(),
});

export const profileSchema = profileSchemaV2.extend({ character: characterSchema, trainingPrefs: trainingPrefsSchema });


export const checkInSchema = legacyCheckInSchema.extend({
  sleepHours: z.number().min(0).max(24).nullable(),
  sleepQuality: z.enum(['poor', 'fair', 'good']).nullable(),
  fatigue: level3.nullable(),
  stress: level3.nullable(),
});

const loadType = z.enum(LOAD_TYPES);

export const sessionSetSchema = z.object({
  id,
  load: z.number().finite().min(0).max(MAX_LOAD).nullable(),
  reps: z.number().int().min(1).max(MAX_REPS).nullable(),
  durationSec: z.number().int().min(1).max(MAX_DURATION_SEC).nullable(),
  rir: z.number().int().min(0).max(10).nullable(),
  completed: z.boolean(),
  completedAt: isoInstant.nullable(),
  prefill: z.enum(['previous', 'planned', 'target', 'none']),
});

export const sessionExerciseSchema = z.object({
  key: id,
  exerciseId: id,
  name: shortText,
  loadType,
  unit: z.enum(WEIGHT_UNITS),
  tags,
  priority: z.boolean(),
  target: z.object({
    sets: z.number().int().min(0).max(20),
    repMin: z.number().int().min(1).max(MAX_REPS).nullable(),
    repMax: z.number().int().min(1).max(MAX_REPS).nullable(),
    durationSec: z.number().int().min(1).max(MAX_DURATION_SEC).nullable(),
    restSec: z.number().int().min(0).max(900),
  }),
  skipped: z.boolean(),
  notes: z.string().max(500),
  sets: z.array(sessionSetSchema).max(50),
});

export const sessionSchema = z.object({
  id,
  schemaVersion: z.literal(3),
  state: z.enum(['active', 'completed', 'discarded']),
  source: z.enum(['programme', 'quick', 'import', 'manual', 'legacy']),
  name: shortText,
  programmeId: id.nullable(),
  dayId: id.nullable(),
  planKind: z.enum(['programme-day', 'shortened', 'adjusted-week', 'quick', 'import', 'legacy']),
  emphasis: z.enum(['upper', 'lower', 'full', 'conditioning']).nullable(),
  checkIn: checkInSchema.nullable(),
  exercises: z.array(sessionExerciseSchema).max(40),
  position: z.number().int().min(0),
  startedAt: isoInstant,
  updatedAt: isoInstant,
  completedAt: isoInstant.nullable(),
  completedLocalDate: localDate.nullable(),
  discardedAt: isoInstant.nullable(),
  pausedAt: isoInstant.nullable(),
  pausedMs: z.number().int().min(0),
  durationSource: z.enum(['timer', 'manual', 'not-recorded', 'legacy-entry-time']),
  durationSec: z.number().int().min(0).max(86_400).nullable(),
  restStartedAt: isoInstant.nullable(),
  restDurationSec: z.number().int().min(0).max(900).nullable(),
  substitutions: z.array(substitutionSchema).max(100),
  importHash: z.string().max(64).nullable(),
  editedAt: isoInstant.nullable(),
});

export const programmeExerciseSchemaV2 = z.object({
  id,
  exerciseId: id,
  name: shortText,
  loadType,
  sets: z.number().int().min(1).max(20),
  repMin: z.number().int().min(1).max(100).nullable(),
  repMax: z.number().int().min(1).max(100).nullable(),
  durationSec: z.number().int().min(1).max(MAX_DURATION_SEC).nullable(),
  restSec: z.number().int().min(0).max(900),
  priority: z.boolean(),
  notes: z.string().max(500),
});

export const programmeSchemaV2 = z.object({
  id,
  name: shortText,
  goal: z.enum(TRAINING_GOALS),
  days: z.array(z.object({ id, name: shortText, exercises: z.array(programmeExerciseSchemaV2).max(30) })).max(14),
  daysPerWeek: z.number().int().min(1).max(7),
  preferredWeekdays: z.array(weekday).max(7),
  isActive: z.boolean(),
  source: z.enum(['created', 'imported', 'starter', 'restored']),
  createdAt: isoInstant,
  updatedAt: isoInstant,
});

export const plannedLoadSchema = z.object({ value: z.number().finite().min(0).max(MAX_LOAD), unit: z.enum(WEIGHT_UNITS) });

export const programmeExerciseSchema = programmeExerciseSchemaV2.extend({ plannedLoad: plannedLoadSchema.nullable() });

export const programmeSchema = programmeSchemaV2.extend({
  days: z.array(z.object({ id, name: shortText, exercises: z.array(programmeExerciseSchema).max(30) })).max(14),
  source: z.enum(['created', 'imported', 'starter', 'restored', 'template']),
  templateId: id.nullable(),
});

export const customExerciseSchema = z.object({ id, name: shortText, loadType, tags, createdAt: isoInstant });

const programmeChange = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rep-range'), programmeId: id, dayId: id, programmeExerciseId: id, name: shortText, from: z.tuple([z.number().int().nullable(), z.number().int().nullable()]), to: z.tuple([z.number().int().nullable(), z.number().int().nullable()]) }),
  z.object({ type: z.literal('sets'), programmeId: id, dayId: id, programmeExerciseId: id, name: shortText, from: z.number().int(), to: z.number().int() }),
  z.object({ type: z.literal('focus'), text: longText }),
  z.object({ type: z.literal('nutrition-target'), fromKcal: z.number().int().min(0).max(10_000).nullable(), toKcal: z.number().int().min(0).max(10_000) }),
]);

export const recommendationSchema = z.object({
  id,
  createdAt: isoInstant,
  kind: z.enum(['plateau', 'weekly', 'schedule', 'nutrition']),
  dedupeKey: z.string().max(200),
  trigger: longText,
  exerciseKey: z.string().max(200).nullable(),
  supportingData: z.array(longText).max(20),
  missingData: z.array(longText).max(20),
  questions: z.array(z.object({ id: z.enum(['sleep', 'harder', 'food', 'missed', 'fatigue', 'intake', 'busy']), text: shortText, answer: z.enum(['yes', 'no', 'unsure']).nullable() })).max(5),
  type: z.enum(['continue', 'review-recovery', 'check-consistency', 'small-progression', 'reorganise-schedule', 'planned-reduction', 'seek-advice', 'review-energy', 'keep-target', 'convenient-protein']),
  title: shortText,
  explanation: longText,
  proposedChange: programmeChange.nullable(),
  status: z.enum(['open', 'accepted', 'rejected', 'postponed']),
  decidedAt: isoInstant.nullable(),
  postponedUntil: localDate.nullable(),
  appliedChange: programmeChange.nullable(),
  followUp: z.object({ dueDate: localDate, outcome: longText.nullable() }).nullable(),
});

export const weekPlanSchema = z.object({
  weekStart: localDate,
  programmeId: id,
  plannedSessions: z.number().int().min(0).max(7),
  availableSessions: z.number().int().min(0).max(7),
  sessions: z
    .array(
      z.object({
        dayId: id,
        name: shortText,
        added: z.array(z.object({ programmeExerciseId: id, name: shortText, sets: z.number().int().min(1).max(20), fromDay: shortText })).max(10),
        estimatedMinutes: z.number().int().min(0).max(600),
      }),
    )
    .max(7),
  tradeoffs: z.array(longText).max(20),
  status: z.enum(['pending', 'approved', 'rejected']),
  decidedAt: isoInstant.nullable(),
});

export const measurementSchema = z.object({
  id,
  localDate,
  bodyweightKg: z.number().min(20).max(400).nullable(),
  waistCm: z.number().min(30).max(300).nullable(),
  note: z.string().max(500),
  createdAt: isoInstant,
});

export const bodyweightSchema = z.object({
  id,
  localDate,
  value: z.number().finite().min(10).max(800),
  unit: z.enum(WEIGHT_UNITS),
  note: z.string().max(200),
  createdAt: isoInstant,
  updatedAt: isoInstant,
});

const nullableInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const nutritionSchema = z.object({
  id: z.literal('me'),
  status: z.enum(['not-asked', 'declined', 'in-progress', 'complete']),
  step: z.number().int().min(0).max(20),
  ageYears: nullableInt(10, 120),
  heightCm: z.number().min(100).max(250).nullable(),
  equationSex: z.enum(['male', 'female', 'unspecified']),
  activity: z.enum(ACTIVITY_LEVELS).nullable(),
  avgSteps: nullableInt(0, 100_000),
  physicalWork: z.boolean().nullable(),
  knownMaintenanceKcal: nullableInt(800, 8000),
  goal: z.enum(NUTRITION_GOALS).nullable(),
  safety: z.object({ under18: z.boolean(), pregnantOrBreastfeeding: z.boolean(), eatingDisorderHistory: z.boolean(), medicalCondition: z.boolean() }),
  target: z
    .object({
      kcal: nullableInt(0, 10_000),
      proteinG: z.tuple([z.number().int().min(0).max(600), z.number().int().min(0).max(600)]).nullable(),
      carbsG: nullableInt(0, 2000),
      fatG: nullableInt(0, 1000),
      source: z.enum(['estimate', 'manual']),
      updatedAt: isoInstant,
    })
    .nullable(),
  habits: z.object({
    source: z.enum(MEAL_SOURCES).nullable(),
    cookedSlots: z.array(z.enum(MEAL_SLOTS)).max(MEAL_SLOTS.length),
    mealsPerDay: nullableInt(1, 8),
    eatingTimes: z.string().max(200),
    budgetPerMealSgd: z.number().min(0).max(500).nullable(),
    cookingMinutes: nullableInt(0, 300),
    kitchen: z.array(z.string().max(40)).max(20),
  }),
  cuisines: z.array(z.enum(CUISINES)).max(CUISINES.length),
  diet: z.array(z.enum(DIET_FLAGS)).max(DIET_FLAGS.length),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
  intolerances: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
  dislikes: z.array(z.string().max(60)).max(50),
  exclusions: z.array(z.string().max(60)).max(50),
  fasting: z.string().max(200).nullable(),
  favourites: z.array(id).max(200),
  updatedAt: isoInstant,
});

export const mealPlanSchema = z.object({
  localDate,
  items: z.array(z.object({ slot: z.enum(MEAL_SLOTS), mealId: id, mode: z.enum(['cook', 'buy']), portion: z.number().min(0.25).max(4) })).max(10),
  updatedAt: isoInstant,
});
