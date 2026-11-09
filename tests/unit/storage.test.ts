import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, MAX_BACKUP_BYTES, parseBackupText, readBackupFile } from '../../src/data/backup';
import { migrateCheckIn, migrateProfile, migrateSession } from '../../src/domain/migrate';
import { buildImportSessions, parseNotes } from '../../src/domain/notesImport';
import { bench, completedSession, CORRUPTED_BACKUP, legacySession, fourDayProgramme, makeCheckIn, makeProfile, newIdFn, T0 } from '../fixtures/factories';

function v2Backup() {
  return {
    format: BACKUP_FORMAT,
    version: 2,
    exportedAt: T0.toISOString(),
    data: {
      profile: makeProfile(),
      checkIns: [makeCheckIn()],
      sessions: [completedSession({ id: 'one', date: '2026-03-09', exercises: [bench([{ load: 30, reps: 8 }])] })],
      programmes: [fourDayProgramme()],
      customExercises: [],
      recommendations: [],
      weekPlans: [],
      measurements: [],
      reviewedWeeks: [],
      legacySessions: [],
    },
  };
}
const text = (v: unknown) => JSON.stringify(v);

describe('Storage', () => {
  it('T34 backup data validates and round-trips', () => {
    const r = parseBackupText(text(v2Backup()));
    expect(r.ok).toBe(true);
    expect(r.ok && r.summary).toMatchObject({ sourceVersion: 2, completedSessions: 1, programmes: 1, hasProfile: true });
    expect(r.ok && r.backup.data.programmes[0]!.days).toHaveLength(4);
  });

  it('T35 restore validates the schema and cross-record consistency', () => {
    const bad = v2Backup();
    (bad.data.sessions[0]!.exercises[0]!.sets[0]! as { load: unknown }).load = -1;
    expect(parseBackupText(text(bad)).ok).toBe(false);
    const twoActive = v2Backup();
    twoActive.data.programmes = [fourDayProgramme(), fourDayProgramme()];
    expect(parseBackupText(text(twoActive))).toEqual({ ok: false, error: 'More than one programme is marked active.' });
    const noSets = v2Backup();
    noSets.data.sessions[0]!.exercises[0]!.sets = [];
    expect(parseBackupText(text(noSets)).ok).toBe(false);
    const uncompleted = v2Backup();
    uncompleted.data.sessions[0]!.exercises[0]!.sets[0]!.completed = false;
    expect(parseBackupText(text(uncompleted))).toEqual({ ok: false, error: 'A completed workout has no completed sets.' });
    expect(parseBackupText(text({ ...v2Backup(), version: 9 }))).toEqual({ ok: false, error: 'Unsupported backup version (9). This app reads versions 1, 2, 3 and 4.' });
  });

  it('T36 corrupted backups are rejected safely', async () => {
    expect(parseBackupText(CORRUPTED_BACKUP)).toEqual({ ok: false, error: 'This file is not valid JSON.' });
    expect(parseBackupText('[]').ok).toBe(false);
    expect(parseBackupText(text({ format: 'other' })).ok).toBe(false);
    let read = false;
    const huge = { size: MAX_BACKUP_BYTES + 1, text: async () => ((read = true), '{}') } as unknown as Blob;
    expect((await readBackupFile(huge)).ok).toBe(false);
    expect(read).toBe(false);
  });

  it('T37 schema migrations preserve valid records', () => {
    const legacy = legacySession();
    const s = migrateSession(legacy);
    expect(s).toMatchObject({ id: 'legacy-1', schemaVersion: 3, state: 'completed', source: 'legacy', name: 'Quick dumbbell strength', completedLocalDate: '2026-02-01', durationSource: 'legacy-entry-time', durationSec: null });
    const squat = s.exercises[0]!;
    expect(squat).toMatchObject({ exerciseId: 'goblet-squat', loadType: 'unspecified', unit: 'kg' });
    expect(squat.sets).toEqual([{ id: 'ls1', load: 30, reps: 10, durationSec: null, rir: null, completed: true, completedAt: '2026-02-01T10:00:20.000Z', prefill: 'none' }]);
    expect(s.exercises[1]!).toMatchObject({ loadType: 'timed' });
    expect(s.exercises[1]!.sets[0]).toMatchObject({ durationSec: 30, reps: null, load: null });
    // V0.1 backups (format 1) are accepted and migrated.
    const v1 = { format: BACKUP_FORMAT, version: 1, exportedAt: T0.toISOString(), data: { profile: { id: 'me', goal: 'strength', experience: 'beginner', equipment: ['bodyweight'], preferredMinutes: 20, weightUnit: 'kg', createdAt: T0.toISOString(), updatedAt: T0.toISOString() }, checkIns: [legacy.checkIn], sessions: [legacy] } };
    const r = parseBackupText(text(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary.sourceVersion).toBe(1);
    expect(r.backup.data.sessions[0]!.exercises[0]!.sets[0]!.load).toBe(30);
    expect(r.backup.data.legacySessions[0]!.record).toEqual(legacy);
    expect(r.backup.data.profile).toMatchObject({ goal: 'strength', gamification: true });
    expect(migrateProfile(makeProfile()).timezone).toBe('UTC');
    expect(migrateCheckIn(legacy.checkIn)).toMatchObject({ sleepHours: null, fatigue: null });
  });

  it('T38 duplicate imports are handled', () => {
    const notes = '2026-03-02\nSmith Bench 30 kg/side 3x8\nPull-ups BW 10, 9, 8';
    const { rows } = parseNotes(notes);
    const first = buildImportSessions({ rows, existing: [], newId: newIdFn, now: T0, defaultUnit: 'kg' });
    expect(first.sessions).toHaveLength(1);
    const again = buildImportSessions({ rows: parseNotes(notes).rows, existing: first.sessions, newId: newIdFn, now: T0, defaultUnit: 'kg' });
    expect(again.sessions).toHaveLength(0);
    expect(again.duplicates).toEqual([{ date: '2026-03-02', name: 'Imported workout' }]);
    const dupBackup = v2Backup();
    dupBackup.data.sessions = [{ ...first.sessions[0]! }, { ...first.sessions[0]!, id: 'other', exercises: first.sessions[0]!.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, id: `${s.id}-x` })) })) }];
    expect(parseBackupText(text(dupBackup))).toEqual({ ok: false, error: 'The backup contains duplicate imported workouts.' });
  });
});
