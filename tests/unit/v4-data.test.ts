/**
 * V0.4 import, storage, revisions and migration (SYNTHETIC data only).
 * Test IDs refer to Sprint4.MD §20.
 */
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { createBackup, parseBackupText, restoreBackup } from '../../src/data/backup';
import { createDb, PRE_V5_SNAPSHOT_KEY, SCHEMA_V4, setDb } from '../../src/data/db';
import * as repo from '../../src/data/repo';
import { fillWeek, historyRecords, importHash, importIssues, resolveNote, templateDays } from '../../src/domain/importer';
import { parseNote } from '../../src/domain/noteParser';
import { buildWeekDraft, dedupeSessions } from '../../src/domain/weekly';
import type { CustomExercise } from '../../src/domain/types';
import { completedSession, bench, fourDayProgramme, makeProfile, newIdFn, T0, useFreshDb } from '../fixtures/factories';

const ctx = () => ({ newId: newIdFn, unit: 'kg' as const, custom: [], created: [] as CustomExercise[], now: T0 });
const NOTE = 'Push day\nSmith Bench 30 kg/side 3x8\nPull-ups BW 10, 9, 8';

describe('Notes import', () => {
  it('T27 historical imports never invent a date', () => {
    const parsed = parseNote(NOTE);
    expect(importIssues(parsed, 'history', { date: null, undated: false }).some((i) => i.blocking && /date/.test(i.message))).toBe(true);
    // Undated: values are kept only as an undated reference, no workout is created.
    const undated = historyRecords(parsed, { date: null, undated: true, hash: 'h', now: T0, unit: 'kg' }, ctx());
    expect(undated.sessions).toEqual([]);
    expect(undated.undated.map((u) => [u.exerciseId, u.sets.length])).toEqual([
      ['smith-bench-press', 3],
      ['pull-up', 3],
    ]);
    // A date written in the note is used for that day only.
    const dated = parseNote('12 Oct 2026\nSmith Bench 30 kg/side 3x8\n\n13 Oct\nPull-ups BW 10');
    const r = historyRecords(dated, { date: null, undated: false, hash: 'h', now: T0, unit: 'kg' }, ctx());
    expect(r.sessions.map((s) => s.completedLocalDate)).toEqual(['2026-10-12']);
    expect(dated.days[1]!.dateIncomplete).toBe('13 Oct'); // no year → not completed automatically
  });

  it('T28 duplicate imports are detected (same text, any whitespace or case)', async () => {
    useFreshDb();
    const h1 = importHash(NOTE, 'history');
    expect(importHash(`  ${NOTE.toUpperCase()}\n\n`, 'history')).toBe(h1);
    expect(importHash(NOTE, 'template')).not.toBe(h1);
    const rec = { id: 'i1', hash: h1, mode: 'history' as const, createdAt: T0.toISOString(), localDate: '2026-10-12', text: NOTE, resultIds: [], undated: [] };
    expect(await repo.saveImportRecord(rec, async () => {})).toEqual({ saved: true });
    expect(await repo.saveImportRecord({ ...rec, id: 'i2' }, async () => {})).toEqual({ saved: false });
    expect(await repo.listImports()).toHaveLength(1);
  });

  it('resolving answers removes uncertainty; strict modes block until resolved', () => {
    const parsed = parseNote('Day\nBench 60kg 5x5');
    expect(importIssues(parsed, 'history', { date: '2026-10-12', undated: false }).filter((i) => i.blocking)).not.toEqual([]);
    const resolved = resolveNote(parsed, { '0:0': { exerciseId: 'barbell-bench-press' } });
    expect(resolved.days[0]!.entries[0]!).toMatchObject({ exerciseId: 'barbell-bench-press', loadType: 'total' });
    expect(importIssues(resolved, 'history', { date: '2026-10-12', undated: false }).filter((i) => i.blocking)).toEqual([]);
    // Swapping "10x3"-style notation.
    const swapped = resolveNote(parseNote('Day\nRows 40kg 3x10'), { '0:0': { swap: true, exerciseId: 'cable-row' } });
    expect(swapped.days[0]!.entries[0]!.values).toMatchObject({ sets: 10, repMin: 3 });
  });

  it('template import keeps text it does not understand', () => {
    const days = templateDays(parseNote('Upper\nSmith Bench 30kg/side 3x8\nfelt strong\n\nBring chalk'), ctx());
    expect(days[0]!.exercises[0]!.notes).toBe('felt strong');
    expect(days[0]!.notes).toBe('Bring chalk');
  });

  it('weekly import fills matching exercises but never marks a session done', () => {
    const p = fourDayProgramme();
    const week = buildWeekDraft({ weekStart: '2026-03-09', programme: p, previousWeek: null, sessions: [], now: T0, unit: 'kg', copy: false });
    const { week: filled, matched, unmatched } = fillWeek(week, parseNote('Upper Body A\nSmith bench 32.5kg/side 9 8 8\nCurl machine 20kg 3x12'), ctx());
    expect(matched).toBe(1);
    expect(unmatched).toEqual(['Curl machine']);
    expect(filled.sessions[0]!.exercises[0]!).toMatchObject({ source: 'imported', text: '32.5 kg/side × 9, 8, 8' });
    expect(filled.sessions.every((r) => r.status === 'not-recorded')).toBe(true);
  });
});

describe('Workout note revisions', () => {
  it('T05 T07 every save keeps an undoable revision; undo restores content but not the active flag', async () => {
    useFreshDb();
    const p = fourDayProgramme();
    await repo.saveNote(p, 'Created', T0, { activate: true });
    const edited = { ...p, days: p.days.map((d, i) => (i === 0 ? { ...d, name: 'Tuesday — Upper' } : d)) };
    await repo.saveNote(edited, 'Renamed day', T0);
    expect((await repo.getActiveProgramme())!.days[0]!.name).toBe('Tuesday — Upper');
    expect(await repo.countNoteRevisions(p.id)).toBe(1);
    const restored = await repo.undoNote(p.id);
    expect(restored!.days[0]!.name).toBe(p.days[0]!.name);
    expect(restored!.isActive).toBe(true);
    expect(await repo.undoNote(p.id)).toBeNull();
  });

  it('T08 deleting a note keeps a recoverable copy and never touches workouts', async () => {
    useFreshDb();
    const p = fourDayProgramme();
    await repo.saveNote(p, 'Created', T0, { activate: true });
    const s = completedSession({ date: '2026-03-02', exercises: [bench([{ load: 30, reps: 8 }])], programmeId: p.id, dayId: p.days[0]!.id });
    await repo.saveImportedSessions([s]);
    await repo.deleteNote(p.id, T0);
    expect(await repo.listProgrammes()).toEqual([]);
    expect(await repo.countNoteRevisions(p.id)).toBe(1);
    expect(await repo.listAllSessions()).toHaveLength(1);
  });

  it('a confirmed week is never overwritten by a draft save', async () => {
    useFreshDb();
    const p = fourDayProgramme();
    const draft = buildWeekDraft({ weekStart: '2026-03-09', programme: p, previousWeek: null, sessions: [], now: T0, unit: 'kg', copy: false });
    await repo.confirmWeek({ ...draft, status: 'confirmed', confirmedAt: T0.toISOString(), revision: 1 }, [], [], null);
    await expect(repo.saveWeekDraft(draft)).rejects.toThrow(/already confirmed/);
  });
});

describe('Migration and backup', () => {
  it('T57 T60 T61 T62 a V0.3 database (v4) upgrades to v5 with every record kept', async () => {
    const name = `v4-mig-${Math.random()}`;
    const old = new Dexie(name);
    old.version(4).stores(SCHEMA_V4);
    await old.open();
    const v3Profile = (({ loggingMode: _l, notifications: _n, ...rest }) => rest)(makeProfile());
    const p = fourDayProgramme();
    const v3Programme = { ...p, days: p.days.map(({ notes: _n, ...d }) => ({ ...d, exercises: d.exercises.map(({ uncertain: _u, ...e }) => e) })) };
    delete (v3Programme as Partial<typeof v3Programme>).notes;
    const sessions = [completedSession({ id: 's1', date: '2026-03-02', exercises: [bench([{ load: 30, reps: 8 }])] })];
    await old.table('profile').put(v3Profile);
    await old.table('programmes').put(v3Programme);
    await old.table('sessions').bulkPut(sessions);
    await old.table('bodyweights').put({ id: 'b1', localDate: '2026-03-01', value: 80, unit: 'kg', note: '', createdAt: T0.toISOString(), updatedAt: T0.toISOString() });
    await old.table('nutrition').put({ id: 'me', status: 'complete' });
    old.close();

    const db = createDb(name);
    setDb(db);
    await db.open();
    expect(db.verno).toBe(5);
    expect(await db.sessions.toArray()).toEqual(sessions);
    expect(await db.bodyweights.count()).toBe(1);
    expect(await db.nutrition.get('me')).toMatchObject({ status: 'complete' });
    // The synthetic workout was logged with the timer, so this user keeps seeing live logging up front.
    expect(await db.profile.get('me')).toMatchObject({ loggingMode: 'live', notifications: { weeklyReminder: true, coachFindings: true }, character: { style: 'warrior' } });
    const migrated = (await db.programmes.toArray())[0]!;
    expect(migrated.notes).toBe('');
    expect(migrated.days.every((d) => d.notes === '' && d.exercises.every((e) => Array.isArray(e.uncertain)))).toBe(true);
    const snap = (await db.meta.get(PRE_V5_SNAPSHOT_KEY))!.value as { programmes: unknown[] };
    expect(snap.programmes).toEqual([v3Programme]);
    setDb(null);
  });

  it('T63 backup format 4 round-trips weekly records, note history and imports', async () => {
    useFreshDb();
    await repo.saveProfile(makeProfile());
    const p = fourDayProgramme();
    await repo.saveNote(p, 'Created', T0, { activate: true });
    await repo.saveNote({ ...p, name: 'Renamed' }, 'Renamed', T0);
    const week = buildWeekDraft({ weekStart: '2026-03-09', programme: p, previousWeek: null, sessions: [], now: T0, unit: 'kg', copy: false });
    await repo.saveWeekDraft(week);
    await repo.saveImportRecord({ id: 'i1', hash: 'template:x', mode: 'template', createdAt: T0.toISOString(), localDate: null, text: 'x', resultIds: [], undated: [] }, async () => {});
    const backup = await createBackup(T0);
    expect(backup.version).toBe(4);
    const parsed = parseBackupText(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    await repo.resetAllData();
    await restoreBackup(parsed.backup);
    expect(await repo.getTrainingWeek('2026-03-09')).toEqual(week);
    expect(await repo.countNoteRevisions(p.id)).toBe(1);
    expect(await repo.listImports()).toHaveLength(1);
  });

  it('dedupe keeps one record when a session was both live-logged and entered weekly', () => {
    const p = fourDayProgramme();
    const live = completedSession({ id: 'live', date: '2026-03-03', exercises: [bench([{ load: 30, reps: 8 }])], programmeId: p.id, dayId: p.days[0]!.id });
    const weekly = { ...completedSession({ id: 'weekly-x', date: '2026-03-04', exercises: [bench([{ load: 30, reps: 8 }])], programmeId: p.id, dayId: p.days[0]!.id }), source: 'weekly' as const };
    const otherDay = { ...weekly, id: 'weekly-y', dayId: p.days[1]!.id };
    expect(dedupeSessions([live, weekly, otherDay]).map((s) => s.id)).toEqual(['live', 'weekly-y']);
  });
});
