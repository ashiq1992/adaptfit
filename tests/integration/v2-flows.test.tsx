import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { createBackup, parseBackupText, restoreBackup } from '../../src/data/backup';
import { createDb, setDb, type AdaptFitDB } from '../../src/data/db';
import * as repo from '../../src/data/repo';
import { addDays, localDateOf } from '../../src/domain/dates';
import { computeRpg } from '../../src/domain/rpg';
import * as W from '../../src/domain/workout';
import { bench, completedSession, fourDayProgramme, legacySession, makeProfile, newIdFn } from '../fixtures/factories';

let db: AdaptFitDB;
const today = localDateOf(new Date(), 'UTC');
const ago = (days: number) => addDays(today, -days);

beforeEach(async () => {
  db = createDb(`adaptfit-v2-${Math.random().toString(36).slice(2)}`);
  setDb(db);
  await db.open();
  window.location.hash = '#/train';
});

async function seedProgramme() {
  const programme = fourDayProgramme();
  await db.profile.put(makeProfile({ goal: 'hypertrophy', timezone: 'UTC' }));
  await db.programmes.put(programme);
  return programme;
}

/** Bench-only history for the programme's first day (priority lift). */
function benchHistory(programme: ReturnType<typeof fourDayProgramme>, reps: number[], everyDays = 5) {
  return reps.map((r, i) =>
    completedSession({ date: ago(everyDays * (reps.length - i)), exercises: [bench([{ load: 30, reps: r }, { load: 30, reps: r }, { load: 30, reps: r }])], programmeId: programme.id, dayId: programme.days[0]!.id }),
  );
}

async function finishViaUi(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Finish' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /^Finish (early|workout)$/ }));
  await screen.findByText('Workout complete');
}

describe('V0.2 integration', () => {
  it('T39 create plan, log a session, view it in History', async () => {
    const user = userEvent.setup();
    await seedProgramme();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Upper Body A' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start workout' }));
    await screen.findByTestId('exercise-name');
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }));
    await waitFor(async () => expect(W.completedSetCount((await repo.getActiveSession())!)).toBe(1));
    await finishViaUi(user);
    window.location.hash = '#/train/history';
    const item = await screen.findByTestId('history-item');
    expect(item).toHaveTextContent('Upper Body A');
    expect(item).toHaveTextContent('Duration not recorded'); // one set in seconds is not a real duration
  });

  it('T40 completing a workout updates Progress', async () => {
    const user = userEvent.setup();
    const p = await seedProgramme();
    await db.sessions.bulkPut(benchHistory(p, [8]));
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await screen.findByTestId('exercise-name');
    // Prefilled from last session (30 kg/side × 8). One tap per set.
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }));
    await waitFor(async () => expect(W.completedSetCount((await repo.getActiveSession())!)).toBe(1));
    await finishViaUi(user);
    window.location.hash = '#/progress';
    expect(await screen.findByTestId('metric-sessions')).toHaveTextContent('2');
  });

  it('T41 completing a planned workout awards XP once', async () => {
    const user = userEvent.setup();
    await seedProgramme();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await screen.findByTestId('exercise-name');
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }));
    await waitFor(async () => expect(W.completedSetCount((await repo.getActiveSession())!)).toBe(1));
    await finishViaUi(user);
    expect(screen.getByTestId('xp-earned')).toHaveTextContent('+30 XP'); // 20 workout + 10 planned
    const sessions = await db.sessions.toArray();
    const rpg = computeRpg({ sessions: [...sessions, ...sessions], checkIns: [], recommendations: [], weekPlans: [], programme: null, reviewedWeeks: [], today });
    expect(rpg.level.totalXP).toBe(30);
  });

  it('T42 editing History recalculates statistics', async () => {
    const user = userEvent.setup();
    const p = await seedProgramme();
    const [a, b] = benchHistory(p, [8, 8]);
    await db.sessions.bulkPut([a!, b!]);
    window.location.hash = '#/train/history';
    render(<App />);
    const latest = (await screen.findAllByTestId('history-item'))[0]!;
    expect(latest).toHaveTextContent('Stable');
    await user.click(within(latest).getByRole('button', { expanded: false }));
    await user.click(within(latest).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    const reps = within(dialog).getByLabelText(/set 1 reps/);
    await user.clear(reps);
    await user.type(reps, '10');
    await user.click(within(dialog).getByRole('button', { name: 'Save correction' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const updated = (await screen.findAllByTestId('history-item'))[0]!;
    await waitFor(() => expect(updated).toHaveTextContent('+2 reps'));
    expect((await db.sessions.get(b!.id))!.editedAt).not.toBeNull();
  });

  it('T43 sufficient history generates a plateau alert', async () => {
    const user = userEvent.setup();
    const p = await seedProgramme();
    await db.sessions.bulkPut(benchHistory(p, [8, 8, 8, 8]));
    window.location.hash = '#/coach';
    render(<App />);
    await user.click(await screen.findByRole('tab', { name: 'Insights' }));
    const card = await screen.findByTestId('recommendation');
    expect(card).toHaveTextContent('Possible plateau — additional context needed.');
    expect(card).toHaveTextContent('Smith machine bench press');
    await waitFor(async () => expect(await db.recommendations.count()).toBe(1));
  });

  it('T44 rejecting a recommendation preserves the existing plan', async () => {
    const user = userEvent.setup();
    const p = await seedProgramme();
    await db.sessions.bulkPut(benchHistory(p, [8, 8, 8, 8]));
    window.location.hash = '#/coach';
    render(<App />);
    await user.click(await screen.findByRole('tab', { name: 'Insights' }));
    const card = await screen.findByTestId('recommendation');
    for (const g of within(card).getAllByRole('group')) await user.click(within(g).getByRole('button', { name: 'No' }));
    await waitFor(() => expect(screen.getByTestId('proposed-change')).toHaveTextContent('6–10 → 6–12'));
    await user.click(within(screen.getByTestId('recommendation')).getByRole('button', { name: 'Reject' }));
    await waitFor(async () => expect((await db.recommendations.toArray())[0]!.status).toBe('rejected'));
    expect(await db.programmes.get(p.id)).toEqual(p);
  });

  it('T45 accepting a recommendation saves the approved plan change', async () => {
    const user = userEvent.setup();
    const p = await seedProgramme();
    await db.sessions.bulkPut(benchHistory(p, [8, 8, 8, 8]));
    window.location.hash = '#/coach';
    render(<App />);
    await user.click(await screen.findByRole('tab', { name: 'Insights' }));
    const card = await screen.findByTestId('recommendation');
    for (const g of within(card).getAllByRole('group')) await user.click(within(g).getByRole('button', { name: 'No' }));
    await waitFor(() => expect(screen.getByTestId('proposed-change')).toHaveTextContent('6–10 → 6–12'));
    await user.click(within(screen.getByTestId('recommendation')).getByRole('button', { name: 'Accept' }));
    await waitFor(async () => expect((await db.programmes.get(p.id))!.days[0]!.exercises[0]!).toMatchObject({ repMin: 6, repMax: 12 }));
    const rec = (await db.recommendations.toArray())[0]!;
    expect(rec).toMatchObject({ status: 'accepted', appliedChange: { type: 'rep-range' } });
    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(await screen.findByTestId('rec-history-item')).toHaveTextContent('accepted');
  });

  it('T46 export and restore reproduce training and character data', async () => {
    const p = await seedProgramme();
    await db.sessions.bulkPut(benchHistory(p, [7, 8, 9]));
    await db.measurements.put({ id: 'm1', localDate: today, bodyweightKg: 75, waistCm: null, note: '', createdAt: new Date().toISOString() });
    await repo.markWeekReviewed('2026-01-05');
    const rpgOf = async () => computeRpg({ sessions: await db.sessions.toArray(), checkIns: await db.checkIns.toArray(), recommendations: [], weekPlans: [], programme: (await db.programmes.toArray())[0] ?? null, reviewedWeeks: await repo.getReviewedWeeks(), today });
    const before = { rpg: await rpgOf(), programmes: await db.programmes.toArray(), measurements: await db.measurements.toArray() };
    const json = JSON.stringify(await createBackup(new Date()));
    await repo.resetAllData();
    expect(await db.sessions.count()).toBe(0);
    const parsed = parseBackupText(json);
    if (!parsed.ok) throw new Error(parsed.error);
    await restoreBackup(parsed.backup);
    expect(await db.programmes.toArray()).toEqual(before.programmes);
    expect(await db.measurements.toArray()).toEqual(before.measurements);
    expect(await rpgOf()).toEqual(before.rpg);
  });

  it('T47 an unfinished workout can be resumed', async () => {
    const user = userEvent.setup();
    const p = await seedProgramme();
    let s = W.sessionFromDay({ id: 'draft', now: new Date(), newId: newIdFn, programme: p, day: p.days[0]!, history: [], unit: 'kg', checkIn: null });
    const ex = s.exercises[0]!;
    s = W.completeSet(W.updateSetValues(s, ex.key, ex.sets[0]!.id, { load: 32.5 }, new Date()), ex.key, ex.sets[0]!.id, new Date());
    s = W.setPosition(s, 1, new Date());
    await db.sessions.put(s);
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Resume workout' }));
    expect(await screen.findByTestId('exercise-name')).toHaveTextContent('Lat pulldown');
    expect(screen.getByTestId('sets-done')).toHaveTextContent('1/');
    await user.click(screen.getByRole('button', { name: /Smith machine bench press/ }));
    expect(await screen.findByRole('button', { name: /Set 1 done/ })).toHaveAccessibleName(/32\.5 kg\/side/);
  });

  it('T48 importing notes saves exactly the confirmed values and skips duplicates', async () => {
    const user = userEvent.setup();
    await seedProgramme();
    window.location.hash = '#/import';
    render(<App />);
    const box = await screen.findByLabelText('Workout notes');
    await user.click(box);
    await user.paste(`${ago(3)}\nSmith Bench 30 kg/side 3x8\nPull-ups BW 10, 9, 8\nBench 60 kg 5x5`);
    await user.click(screen.getByRole('button', { name: 'Review import' }));
    const rows = await screen.findAllByTestId('import-row');
    expect(rows).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^Save/ })).toBeDisabled(); // "Bench" needs a variation and convention
    await user.click(within(rows[2]!).getByRole('checkbox', { name: 'Include' }));
    await user.click(screen.getByRole('button', { name: 'Save 2 exercise records' }));
    expect(await screen.findByTestId('import-result')).toHaveTextContent('1 workout imported.');
    const [s] = await db.sessions.toArray();
    expect(s).toMatchObject({ source: 'import', completedLocalDate: ago(3), durationSec: null });
    expect(s!.exercises.map((e) => [e.exerciseId, e.loadType, e.sets.map((x) => [x.load, x.reps])])).toEqual([
      ['smith-bench-press', 'per-side', [[30, 8], [30, 8], [30, 8]]],
      ['pull-up', 'bodyweight', [[null, 10], [null, 9], [null, 8]]],
    ]);
    // Import the same notes again → duplicate skipped.
    await user.clear(screen.getByLabelText('Workout notes'));
    await user.click(screen.getByLabelText('Workout notes'));
    await user.paste(`${ago(3)}\nSmith Bench 30 kg/side 3x8\nPull-ups BW 10, 9, 8`);
    await user.click(screen.getByRole('button', { name: 'Review import' }));
    await user.click(await screen.findByRole('button', { name: 'Save 2 exercise records' }));
    await waitFor(() => expect(screen.getByTestId('import-result')).toHaveTextContent('0 workouts imported. 1 duplicate was skipped.'));
    expect(await db.sessions.count()).toBe(1);
  });
});

describe('Database migration v2 → v3', () => {
  it('T37 upgrading preserves V0.1 records and keeps a verbatim copy', async () => {
    const Dexie = (await import('dexie')).default;
    const { SCHEMA_V2, DB_VERSION } = await import('../../src/data/db');
        const name = `adaptfit-upgrade-${Math.random().toString(36).slice(2)}`;
    const v2 = new Dexie(name);
    v2.version(2).stores(SCHEMA_V2);
    await v2.open();
    const legacy = legacySession();
    await v2.table('profile').put({ id: 'me', goal: 'strength', experience: 'beginner', equipment: ['bodyweight'], preferredMinutes: 20, weightUnit: 'kg', createdAt: legacy.startedAt, updatedAt: legacy.startedAt });
    await v2.table('checkIns').put(legacy.checkIn);
    await v2.table('sessions').put(legacy);
    v2.close();

    const upgraded = createDb(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(DB_VERSION);
    expect(await upgraded.profile.get('me')).toMatchObject({ goal: 'strength', gamification: true, lifestyle: { work: null } });
    expect(await upgraded.checkIns.get('2026-02-01')).toMatchObject({ sleepHours: null });
    const s = (await upgraded.sessions.get('legacy-1'))!;
    expect(s).toMatchObject({ schemaVersion: 3, state: 'completed', source: 'legacy', durationSec: null });
    expect(s.exercises[0]!.sets[0]).toMatchObject({ load: 30, reps: 10, completed: true });
    expect((await upgraded.legacySessions.get('legacy-1'))!.record).toEqual(legacy);
    upgraded.close();
  });
});
