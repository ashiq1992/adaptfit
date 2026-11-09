import Dexie, { type EntityTable } from 'dexie';
import type { LegacySessionV2 } from '../domain/legacy';
import { bodyweightFromMeasurement, migrateCheckIn, migrateProfile, migrateProgramme, toV3Session } from '../domain/migrate';
import type {
  BodyweightEntry,
  CheckIn,
  CoachRecommendation,
  CustomExercise,
  Measurement,
  MealPlan,
  NoteRevision,
  NutritionProfile,
  Profile,
  Programme,
  TrainingWeek,
  WeekPlan,
  WorkoutImportRecord,
  WorkoutSession,
} from '../domain/types';

export const DB_NAME = 'adaptfit';

export interface MetaRecord {
  key: string;
  value: unknown;
}

/** Verbatim copy of a pre-V0.2 session, kept so an upgrade can always be undone. */
export interface LegacySessionRecord {
  id: string;
  copiedAt: string;
  record: LegacySessionV2;
}

export type AdaptFitDB = Dexie & {
  profile: EntityTable<Profile, 'id'>;
  checkIns: EntityTable<CheckIn, 'localDate'>;
  sessions: EntityTable<WorkoutSession, 'id'>;
  meta: EntityTable<MetaRecord, 'key'>;
  programmes: EntityTable<Programme, 'id'>;
  customExercises: EntityTable<CustomExercise, 'id'>;
  recommendations: EntityTable<CoachRecommendation, 'id'>;
  weekPlans: EntityTable<WeekPlan, 'weekStart'>;
  measurements: EntityTable<Measurement, 'id'>;
  legacySessions: EntityTable<LegacySessionRecord, 'id'>;
  bodyweights: EntityTable<BodyweightEntry, 'id'>;
  nutrition: EntityTable<NutritionProfile, 'id'>;
  mealPlans: EntityTable<MealPlan, 'localDate'>;
  trainingWeeks: EntityTable<TrainingWeek, 'weekStart'>;
  noteRevisions: EntityTable<NoteRevision, 'id'>;
  imports: EntityTable<WorkoutImportRecord, 'id'>;
};

/** Version 1 (V0.1 initial release). */
export const SCHEMA_V1 = {
  profile: 'id',
  checkIns: 'localDate',
  sessions: 'id, state, completedAt',
};

/** Version 2 (V0.1): meta table and extra session indexes. */
export const SCHEMA_V2 = {
  profile: 'id',
  checkIns: 'localDate',
  sessions: 'id, state, completedAt, completedLocalDate, startedAt',
  meta: 'key',
};

/** Version 3 (V0.2): programmes, coaching, lifestyle, and the new session model. */
export const SCHEMA_V3 = {
  profile: 'id',
  checkIns: 'localDate',
  sessions: 'id, state, completedAt, completedLocalDate, startedAt, importHash',
  meta: 'key',
  programmes: 'id, isActive',
  customExercises: 'id',
  recommendations: 'id, status, dedupeKey',
  weekPlans: 'weekStart',
  measurements: 'id, localDate',
  legacySessions: 'id',
};

/** Version 4 (V0.3): bodyweight log, AdaptFit Fuel, daily meal plans. */
export const SCHEMA_V4 = {
  ...SCHEMA_V3,
  bodyweights: 'id, localDate',
  nutrition: 'id',
  mealPlans: 'localDate',
};

/** Version 5 (V0.4): weekly training records, note revisions, note imports. */
export const SCHEMA_V5 = {
  ...SCHEMA_V4,
  trainingWeeks: 'weekStart',
  noteRevisions: 'id, programmeId, at',
  imports: 'id, hash',
};

export const DB_VERSION = 5;

/** Meta key holding the pre-V0.3 copy of every record the v4 upgrade changes. */
export const PRE_V4_SNAPSHOT_KEY = 'snapshot:pre-v0.3';
/** Meta key holding the pre-V0.4 copy of every record the v5 upgrade changes. */
export const PRE_V5_SNAPSHOT_KEY = 'snapshot:pre-v0.4';

export function createDb(name: string = DB_NAME): AdaptFitDB {
  const db = new Dexie(name) as AdaptFitDB;
  db.version(1).stores(SCHEMA_V1);
  db.version(2)
    .stores(SCHEMA_V2)
    .upgrade(async (tx) => {
      await tx
        .table('sessions')
        .toCollection()
        .modify((s: Partial<LegacySessionV2>) => {
          s.substitutions ??= [];
          s.restStartedAt ??= null;
          s.restDurationSec ??= null;
          s.discardedAt ??= null;
          s.recommendedPlan ??= s.plan;
        });
    });
  db.version(3)
    .stores(SCHEMA_V3)
    .upgrade(async (tx) => {
      const copiedAt = new Date().toISOString();
      const profile = await tx.table('profile').get('me');
      const unit = profile?.weightUnit ?? 'kg';
      if (profile) await tx.table('profile').put(migrateProfile(profile));
      await tx.table('checkIns').toCollection().modify((c: CheckIn) => {
        Object.assign(c, migrateCheckIn(c));
      });
      const sessions = await tx.table('sessions').toArray();
      for (const raw of sessions) {
        if ((raw as { schemaVersion?: number }).schemaVersion === 3) continue;
        await tx.table('legacySessions').put({ id: raw.id, copiedAt, record: structuredClone(raw) });
        await tx.table('sessions').put(toV3Session(raw, unit));
      }
    });
  db.version(4)
    .stores(SCHEMA_V4)
    .upgrade(async (tx) => {
      // 1. Keep an exact copy of everything this upgrade touches (rollback aid).
      const profile = await tx.table('profile').get('me');
      const programmes = await tx.table('programmes').toArray();
      const measurements = (await tx.table('measurements').toArray()) as Measurement[];
      await tx.table('meta').put({ key: PRE_V4_SNAPSHOT_KEY, value: structuredClone({ copiedAt: new Date().toISOString(), profile: profile ?? null, programmes, measurements }) });
      // 2. Add the new optional fields.
      if (profile) await tx.table('profile').put(migrateProfile(profile));
      for (const p of programmes) await tx.table('programmes').put(migrateProgramme(p));
      // 3. Move bodyweight into its own log; waist measurements stay where they were.
      for (const m of measurements) {
        const bw = bodyweightFromMeasurement(m);
        if (!bw) continue;
        await tx.table('bodyweights').put(bw);
        if (m.waistCm === null) await tx.table('measurements').delete(m.id);
        else await tx.table('measurements').put({ ...m, bodyweightKg: null });
      }
    });
  db.version(5)
    .stores(SCHEMA_V5)
    .upgrade(async (tx) => {
      // V0.4 only adds fields; workouts, check-ins, bodyweight and nutrition are untouched.
      // Legacy character and gamification settings stay in the profile (archived, no longer shown).
      const profile = await tx.table('profile').get('me');
      const programmes = await tx.table('programmes').toArray();
      await tx.table('meta').put({ key: PRE_V5_SNAPSHOT_KEY, value: structuredClone({ copiedAt: new Date().toISOString(), profile: profile ?? null, programmes }) });
      if (profile) {
        // Someone who already logs set by set keeps seeing that option up front.
        const liveLogged = (await tx.table('sessions').filter((s: WorkoutSession) => s.state === 'completed' && s.durationSource === 'timer').count()) > 0;
        const migrated = migrateProfile(profile);
        await tx.table('profile').put({ ...migrated, loggingMode: (profile as Partial<Profile>).loggingMode ?? (liveLogged ? 'live' : 'weekly') });
      }
      for (const p of programmes) await tx.table('programmes').put(migrateProgramme(p));
    });
  return db;
}

let instance: AdaptFitDB | null = null;

export function getDb(): AdaptFitDB {
  instance ??= createDb();
  return instance;
}

/** Test hook: swap the database instance (e.g. a fresh fake-indexeddb). */
export function setDb(db: AdaptFitDB | null): void {
  instance = db;
}

/** Tables that hold personal records (everything is personal; all are cleared on reset). */
export function personalTables(db: AdaptFitDB) {
  return [db.profile, db.checkIns, db.sessions, db.meta, db.programmes, db.customExercises, db.recommendations, db.weekPlans, db.measurements, db.legacySessions, db.bodyweights, db.nutrition, db.mealPlans, db.trainingWeeks, db.noteRevisions, db.imports];
}
