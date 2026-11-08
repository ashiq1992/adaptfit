import { z } from 'zod';
import type { LegacyProfile, LegacySessionV2 } from '../domain/legacy';
import { bodyweightFromMeasurement, migrateCheckIn, migrateProfile, migrateProgramme, migrateSession } from '../domain/migrate';
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
  WeekPlan,
  WorkoutSession,
} from '../domain/types';
import { isCompletedSet } from '../domain/workout';
import { MAX_BACKUP_BYTES } from './backupLimits';
import { getDb, type LegacySessionRecord, personalTables } from './db';
import { StorageError } from './repo';
import {
  bodyweightSchema,
  checkInSchema,
  customExerciseSchema,
  legacyCheckInSchema,
  legacyProfileSchema,
  legacySessionSchema,
  mealPlanSchema,
  measurementSchema,
  nutritionSchema,
  profileSchema,
  profileSchemaV2,
  programmeSchema,
  programmeSchemaV2,
  recommendationSchema,
  sessionSchema,
  weekPlanSchema,
} from './schemas';

export { MAX_BACKUP_BYTES } from './backupLimits';

export const BACKUP_FORMAT = 'adaptfit-backup';
export const BACKUP_VERSION = 3;
export const SUPPORTED_BACKUP_VERSIONS: readonly number[] = [1, 2, 3];

const v1Schema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  data: z.object({
    profile: legacyProfileSchema.nullable(),
    checkIns: z.array(legacyCheckInSchema).max(10_000),
    sessions: z.array(legacySessionSchema).max(10_000),
  }),
});

const v2Data = z.object({
  profile: profileSchemaV2.nullable(),
  checkIns: z.array(checkInSchema).max(10_000),
  sessions: z.array(sessionSchema).max(10_000),
  programmes: z.array(programmeSchemaV2).max(100),
  customExercises: z.array(customExerciseSchema).max(1000),
  recommendations: z.array(recommendationSchema).max(5000),
  weekPlans: z.array(weekPlanSchema).max(1000),
  measurements: z.array(measurementSchema).max(5000),
  reviewedWeeks: z.array(z.string().max(10)).max(2000),
  legacySessions: z.array(z.object({ id: z.string().max(120), copiedAt: z.iso.datetime(), record: z.unknown() })).max(10_000),
});

const v2Schema = z.object({ format: z.literal(BACKUP_FORMAT), version: z.literal(2), exportedAt: z.iso.datetime(), data: v2Data });

const v3Schema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(3),
  exportedAt: z.iso.datetime(),
  data: z.object({
    profile: profileSchema.nullable(),
    checkIns: z.array(checkInSchema).max(10_000),
    sessions: z.array(sessionSchema).max(10_000),
    programmes: z.array(programmeSchema).max(100),
    customExercises: z.array(customExerciseSchema).max(1000),
    recommendations: z.array(recommendationSchema).max(5000),
    weekPlans: z.array(weekPlanSchema).max(1000),
    measurements: z.array(measurementSchema).max(5000),
    reviewedWeeks: z.array(z.string().max(10)).max(2000),
    legacySessions: z.array(z.object({ id: z.string().max(120), copiedAt: z.iso.datetime(), record: z.unknown() })).max(10_000),
    bodyweights: z.array(bodyweightSchema).max(20_000),
    nutrition: nutritionSchema.nullable(),
    mealPlans: z.array(mealPlanSchema).max(5000),
  }),
});

export interface BackupData {
  profile: Profile | null;
  checkIns: CheckIn[];
  sessions: WorkoutSession[];
  programmes: Programme[];
  customExercises: CustomExercise[];
  recommendations: CoachRecommendation[];
  weekPlans: WeekPlan[];
  measurements: Measurement[];
  reviewedWeeks: string[];
  legacySessions: LegacySessionRecord[];
  bodyweights: BodyweightEntry[];
  nutrition: NutritionProfile | null;
  mealPlans: MealPlan[];
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: BackupData;
}

export interface BackupSummary {
  exportedAt: string;
  sourceVersion: number;
  hasProfile: boolean;
  checkIns: number;
  completedSessions: number;
  hasActiveSession: boolean;
  programmes: number;
  bodyweights: number;
  hasNutrition: boolean;
}

export type BackupParseResult = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; error: string };

const fail = (error: string): BackupParseResult => ({ ok: false, error });

function dupes<T>(items: readonly T[], key: (t: T) => string): string | null {
  const seen = new Set<string>();
  for (const i of items) {
    const k = key(i);
    if (seen.has(k)) return k;
    seen.add(k);
  }
  return null;
}

/** Cross-record checks the schema alone cannot express. Returns an error message or null. */
export function checkBackupConsistency(d: BackupData): string | null {
  if (dupes(d.checkIns, (c) => c.localDate)) return `Duplicate check-in for ${dupes(d.checkIns, (c) => c.localDate)}.`;
  if (dupes(d.sessions, (s) => s.id)) return 'Duplicate workout IDs found.';
  if (dupes(d.programmes, (p) => p.id)) return 'Duplicate programme IDs found.';
  if (dupes(d.recommendations, (r) => r.id)) return 'Duplicate recommendation IDs found.';
  if (dupes(d.weekPlans, (w) => w.weekStart)) return 'Duplicate week plans found.';
  if (dupes(d.measurements, (m) => m.id)) return 'Duplicate measurement IDs found.';
  if (dupes(d.bodyweights, (b) => b.id)) return 'Duplicate bodyweight IDs found.';
  if (dupes(d.mealPlans, (m) => m.localDate)) return 'Duplicate meal plans found.';
  if (d.programmes.filter((p) => p.isActive).length > 1) return 'More than one programme is marked active.';
  for (const p of d.programmes) {
    if (dupes(p.days, (x) => x.id)) return `Programme "${p.name}" has duplicate day IDs.`;
    for (const day of p.days) {
      for (const e of day.exercises) if (e.repMin !== null && e.repMax !== null && e.repMin > e.repMax) return `Programme "${p.name}": invalid rep range for ${e.name}.`;
    }
  }
  const imported = d.sessions.filter((s) => s.importHash);
  if (dupes(imported, (s) => s.importHash!)) return 'The backup contains duplicate imported workouts.';

  const setIds = new Set<string>();
  let active = 0;
  for (const s of d.sessions) {
    if (dupes(s.exercises, (e) => e.key)) return 'A workout contains duplicate exercise slots.';
    for (const e of s.exercises) {
      for (const set of e.sets) {
        if (setIds.has(set.id)) return 'Duplicate set IDs found.';
        setIds.add(set.id);
        if (set.completed && !set.completedAt) return 'A completed set is missing its completion time.';
      }
    }
    if (s.exercises.length > 0 && s.position >= s.exercises.length) return 'A workout has an invalid saved position.';
    switch (s.state) {
      case 'active':
        active += 1;
        if (s.completedAt || s.completedLocalDate || s.discardedAt) return 'An active workout has completion data.';
        break;
      case 'completed':
        if (!s.completedAt || !s.completedLocalDate) return 'A completed workout is missing its completion date.';
        if (s.discardedAt) return 'A completed workout is also marked discarded.';
        if (!s.exercises.some((e) => e.sets.some((x) => isCompletedSet(x, e.loadType)))) return 'A completed workout has no completed sets.';
        break;
      case 'discarded':
        if (!s.discardedAt) return 'A discarded workout is missing its discard time.';
        if (s.completedAt) return 'A discarded workout is also marked completed.';
        break;
    }
  }
  if (active > 1) return 'The backup contains more than one active workout.';
  return null;
}

function legacyConsistency(sessions: LegacySessionV2[]): string | null {
  const ids = new Set<string>();
  const setIds = new Set<string>();
  let active = 0;
  for (const s of sessions) {
    if (ids.has(s.id)) return 'Duplicate workout IDs found.';
    ids.add(s.id);
    const keys = new Set(s.plan.items.map((i) => i.key));
    if (keys.size !== s.plan.items.length) return 'A workout contains duplicate exercise slots.';
    for (const set of s.sets) {
      if (setIds.has(set.id)) return 'Duplicate set IDs found.';
      setIds.add(set.id);
      if (!keys.has(set.itemKey)) return 'A logged set refers to an exercise that is not in its workout.';
    }
    if (s.position >= s.plan.items.length) return 'A workout has an invalid saved position.';
    if (s.state === 'active') active += 1;
    if (s.state === 'completed' && (!s.completedAt || !s.completedLocalDate || s.sets.length === 0)) return 'A completed workout is incomplete.';
    if (s.state === 'discarded' && !s.discardedAt) return 'A discarded workout is missing its discard time.';
  }
  return active > 1 ? 'The backup contains more than one active workout.' : null;
}

function summarize(b: Backup, sourceVersion: number): BackupSummary {
  return {
    exportedAt: b.exportedAt,
    sourceVersion,
    hasProfile: b.data.profile !== null,
    checkIns: b.data.checkIns.length,
    completedSessions: b.data.sessions.filter((s) => s.state === 'completed').length,
    hasActiveSession: b.data.sessions.some((s) => s.state === 'active'),
    programmes: b.data.programmes.length,
    bodyweights: b.data.bodyweights.length,
    hasNutrition: b.data.nutrition !== null && b.data.nutrition.status !== 'not-asked',
  };
}

/** Validate and normalise untrusted backup text. Never mutates storage. */
export function parseBackupText(text: string): BackupParseResult {
  if (text.length > MAX_BACKUP_BYTES) return fail('This backup is too large.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('This file is not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail('This file is not an AdaptFit backup.');
  const header = raw as Record<string, unknown>;
  if (header.format !== BACKUP_FORMAT) return fail('This file is not an AdaptFit backup.');
  if (typeof header.version !== 'number' || !SUPPORTED_BACKUP_VERSIONS.includes(header.version))
    return fail(`Unsupported backup version (${String(header.version)}). This app reads versions ${SUPPORTED_BACKUP_VERSIONS.slice(0, -1).join(', ')} and ${SUPPORTED_BACKUP_VERSIONS[SUPPORTED_BACKUP_VERSIONS.length - 1]}.`);

  const describe = (issues: z.core.$ZodIssue[]) => {
    const issue = issues[0];
    return `The backup has invalid data${issue?.path.length ? ` at ${issue.path.join('.')}` : ''}.`;
  };

  if (header.version === 1) {
    const parsed = v1Schema.safeParse(raw);
    if (!parsed.success) return fail(describe(parsed.error.issues));
    const legacy = parsed.data.data;
    const problem = legacyConsistency(legacy.sessions as LegacySessionV2[]);
    if (problem) return fail(problem);
    const unit = legacy.profile?.weightUnit ?? 'kg';
    const backup: Backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: parsed.data.exportedAt,
      data: {
        profile: legacy.profile ? migrateProfile(legacy.profile as LegacyProfile) : null,
        checkIns: legacy.checkIns.map(migrateCheckIn),
        sessions: legacy.sessions.map((s) => migrateSession(s as LegacySessionV2, unit)),
        programmes: [],
        customExercises: [],
        recommendations: [],
        weekPlans: [],
        measurements: [],
        reviewedWeeks: [],
        legacySessions: legacy.sessions.map((s) => ({ id: s.id, copiedAt: parsed.data.exportedAt, record: s as LegacySessionV2 })),
        bodyweights: [],
        nutrition: null,
        mealPlans: [],
      },
    };
    const consistency = checkBackupConsistency(backup.data);
    if (consistency) return fail(consistency);
    return { ok: true, backup, summary: summarize(backup, 1) };
  }

  if (header.version === 2) {
    const parsed = v2Schema.safeParse(raw);
    if (!parsed.success) return fail(describe(parsed.error.issues));
    const d = parsed.data.data;
    // V0.2 → V0.3: add new optional fields and move bodyweight out of measurements, exactly like the database upgrade.
    const measurements = d.measurements as Measurement[];
    const backup: Backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: parsed.data.exportedAt,
      data: {
        ...(d as unknown as Omit<BackupData, 'profile' | 'programmes' | 'measurements' | 'bodyweights' | 'nutrition' | 'mealPlans'>),
        profile: d.profile ? migrateProfile(d.profile as Profile) : null,
        programmes: (d.programmes as Programme[]).map(migrateProgramme),
        measurements: measurements.filter((m) => m.waistCm !== null).map((m) => ({ ...m, bodyweightKg: null })),
        bodyweights: measurements.map(bodyweightFromMeasurement).filter((b): b is BodyweightEntry => b !== null),
        nutrition: null,
        mealPlans: [],
      },
    };
    const consistency = checkBackupConsistency(backup.data);
    if (consistency) return fail(consistency);
    return { ok: true, backup, summary: summarize(backup, 2) };
  }

  const parsed = v3Schema.safeParse(raw);
  if (!parsed.success) return fail(describe(parsed.error.issues));
  const backup = parsed.data as unknown as Backup;
  const consistency = checkBackupConsistency(backup.data);
  if (consistency) return fail(consistency);
  return { ok: true, backup, summary: summarize(backup, 3) };
}

/** Size-limit before reading, then validate. */
export async function readBackupFile(file: Blob): Promise<BackupParseResult> {
  if (file.size > MAX_BACKUP_BYTES) return fail(`This backup is larger than ${MAX_BACKUP_BYTES / 1024 / 1024} MB and was not read.`);
  let text: string;
  try {
    text = await file.text();
  } catch {
    return fail('The file could not be read.');
  }
  return parseBackupText(text);
}

export async function createBackup(now: Date): Promise<Backup> {
  const db = getDb();
  try {
    return await db.transaction('r', personalTables(db), async () => ({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      data: {
        profile: (await db.profile.get('me')) ?? null,
        checkIns: await db.checkIns.orderBy('localDate').toArray(),
        sessions: await db.sessions.orderBy('id').toArray(),
        programmes: await db.programmes.orderBy('id').toArray(),
        customExercises: await db.customExercises.orderBy('id').toArray(),
        recommendations: await db.recommendations.orderBy('id').toArray(),
        weekPlans: await db.weekPlans.orderBy('weekStart').toArray(),
        measurements: await db.measurements.orderBy('id').toArray(),
        reviewedWeeks: (((await db.meta.get('reviewedWeeks'))?.value as string[] | undefined) ?? []).slice().sort(),
        legacySessions: await db.legacySessions.orderBy('id').toArray(),
        bodyweights: await db.bodyweights.orderBy('id').toArray(),
        nutrition: (await db.nutrition.get('me')) ?? null,
        mealPlans: await db.mealPlans.orderBy('localDate').toArray(),
      },
    }));
  } catch (err) {
    throw new StorageError("Couldn't read your data for export. Please try again.", { cause: err });
  }
}

export function backupFileName(now: Date): string {
  return `adaptfit-backup-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Replace all data with a validated backup in a single transaction. If any
 * write fails, the transaction aborts and existing data is untouched.
 */
export async function restoreBackup(backup: Backup): Promise<void> {
  const consistency = checkBackupConsistency(backup.data);
  if (consistency) throw new StorageError(consistency);
  const db = getDb();
  const d = backup.data;
  try {
    await db.transaction('rw', personalTables(db), async () => {
      await Promise.all(personalTables(db).map((t) => t.clear()));
      if (d.profile) await db.profile.add(d.profile);
      await db.checkIns.bulkAdd(d.checkIns);
      await db.sessions.bulkAdd(d.sessions);
      await db.programmes.bulkAdd(d.programmes);
      await db.customExercises.bulkAdd(d.customExercises);
      await db.recommendations.bulkAdd(d.recommendations);
      await db.weekPlans.bulkAdd(d.weekPlans);
      await db.measurements.bulkAdd(d.measurements);
      await db.legacySessions.bulkAdd(d.legacySessions);
      await db.bodyweights.bulkAdd(d.bodyweights);
      if (d.nutrition) await db.nutrition.add(d.nutrition);
      await db.mealPlans.bulkAdd(d.mealPlans);
      if (d.reviewedWeeks.length) await db.meta.put({ key: 'reviewedWeeks', value: d.reviewedWeeks });
    });
  } catch (err) {
    throw new StorageError('Restore failed and your existing data was kept. Please try again.', { cause: err });
  }
}
