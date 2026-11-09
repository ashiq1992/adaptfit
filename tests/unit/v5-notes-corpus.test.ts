import { describe, expect, it } from 'vitest';
import { fillWeek, historyRecords, importIssues, resolveNote, templateDays } from '../../src/domain/importer';
import { parseDateLine } from '../../src/domain/notesImport';
import { type NoteEntry, parseNote, type ParsedNote, parseValues, performanceSets, stripBullet } from '../../src/domain/noteParser';
import { createProgramme } from '../../src/domain/programme';
import type { CustomExercise, PerformanceSet } from '../../src/domain/types';
import { buildWeekDraft } from '../../src/domain/weekly';
import { newIdFn } from '../fixtures/factories';
import { CORPUS, type CorpusKey } from './notes-corpus';

/**
 * A corpus of real-world note styles. The product promises, checked for every note:
 *  - nothing is invented (no bar weight, no dates, no extra sets);
 *  - anything guessed is listed in `assumptions` or `uncertain` for review;
 *  - every line ends up somewhere (an exercise, a comment, a day note, the
 *    preamble or `unparsed`) — no line is silently lost;
 *  - what was logged is kept exactly, separately from the plan.
 */

const parse = (k: CorpusKey) => parseNote(CORPUS[k], { defaultUnit: 'kg' });
const entries = (k: CorpusKey) => parse(k).days.flatMap((d) => d.entries);
const logged = (e: NoteEntry): PerformanceSet[] => performanceSets(e.values, e.loadType ?? e.suggestedLoadType ?? 'total');
const sets = (load: number | null, reps: number[]) => reps.map((r) => ({ load, reps: r, durationSec: null }));
const ctx = () => ({ newId: newIdFn, unit: 'kg' as const, custom: [] as CustomExercise[], created: [] as CustomExercise[], now: new Date('2026-11-09T10:00:00Z') });

const norm = (s: string) =>
  stripBullet(s)
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Where a line of the note ended up, or null when it was lost. */
function placeOf(line: string, note: ParsedNote): string | null {
  const t = line.trim();
  const n = norm(t);
  const all = note.days.flatMap((d) => d.entries);
  if (all.some((e) => e.raw.some((r) => r.trim() === t))) return 'exercise';
  const same = (s: string) => s.trim() === t || norm(s) === n;
  if (all.some((e) => e.comments.some(same))) return 'comment';
  if (note.days.some((d) => d.notes.some(same))) return 'day note';
  if (note.preamble.some(same)) return 'preamble';
  if (note.unparsed.some((u) => u.raw.trim() === t)) return 'unparsed';
  if (note.days.some((d) => d.heading && n.includes(norm(d.heading)) && norm(d.heading).length > 1)) return 'heading';
  const date = parseDateLine(stripBullet(t));
  if (date && 'date' in date && note.days.some((d) => d.date === date.date)) return 'date';
  if (note.days.some((d) => d.dateIncomplete && n.includes(d.dateIncomplete.toLowerCase()))) return 'date';
  return null;
}

describe('Notes corpus: invariants for every note', () => {
  const keys = Object.keys(CORPUS) as CorpusKey[];

  it('has a varied corpus (25–40 notes)', () => {
    expect(keys.length).toBeGreaterThanOrEqual(25);
    expect(keys.length).toBeLessThanOrEqual(40);
  });

  it.each(keys)('%s: no non-blank line is silently lost', (k) => {
    const note = parse(k);
    const lost = CORPUS[k]
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .filter((l) => placeOf(l, note) === null);
    expect(lost).toEqual([]);
  });

  it.each(keys)('%s: nothing invented — every load, rep count and date comes from the text', (k) => {
    const text = CORPUS[k];
    const note = parse(k);
    const numbersIn = (s: string) => (s.replace(/(\d),(\d)/g, '$1.$2').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (const e of note.days.flatMap((d) => d.entries)) {
      const written = numbersIn(e.raw.join(' '));
      for (const s of logged(e)) {
        if (s.load !== null) expect(written, `${e.name} load ${s.load}`).toContain(s.load);
        if (s.reps !== null) expect(written, `${e.name} reps ${s.reps}`).toContain(s.reps);
      }
      // A unit is either written on the line, or taken from the rest of the note and said so.
      if (e.values?.load != null && e.unit && !/kg|kilo|lb|pound/i.test(e.raw.join(' '))) expect(e.assumptions.join(' ')).toMatch(/read as (kg|lb)/);
      // A loading convention for a load is either written, the machine default, or asked.
      if (e.values?.load != null && e.loadType === null) expect(e.uncertain).toContain('loadType');
    }
    for (const d of note.days) if (d.date) expect(text).toContain(d.date.slice(0, 4));
  });

  it.each(keys)('%s: a guess is always visible for review', (k) => {
    for (const e of entries(k)) {
      if (e.uncertain.includes('exercise')) expect(e.candidates.length).toBeGreaterThan(1);
      if (e.uncertain.includes('loadType')) expect(e.loadType).toBeNull();
      if (e.values?.load != null && !e.unit) expect(e.uncertain).toContain('unit');
    }
  });
});

describe('Notes corpus: what each style records', () => {
  it('the user’s blocks: plan (sets × reps, rest) and what was done are kept apart', () => {
    const [db, lat, row] = entries('userBlocks');
    expect(db).toMatchObject({ name: 'Dumbbell bench press', suggestedLoadType: 'per-dumbbell' });
    expect(db!.values).toMatchObject({ sets: 4, repMin: 6, repMax: 6, restSec: 120 });
    expect(logged(db!)).toEqual(sets(27.5, [7]));
    expect(lat!.values).toMatchObject({ sets: 4, repMin: 6, restSec: 120 });
    expect(logged(lat!)).toEqual(sets(76, [8]));
    expect(lat!.comments).toEqual(['Weighted if possible', 'RIR 1', 'Added 1 (no unit written, so not counted in the weight)']);
    expect(row).toMatchObject({ name: 'Chest Supported Row', known: false });
    expect(logged(row!)).toEqual(sets(45, [8, 8, 8]));
  });

  it('"60x8, 65x6, 70x5": a weight per set, kept per set', () => {
    const [bench, incline, fly] = entries('perSetLoads');
    expect(bench).toMatchObject({ exerciseId: 'barbell-bench-press', loadType: 'total', unit: 'kg' });
    expect(logged(bench!)).toEqual([
      { load: 60, reps: 8, durationSec: null },
      { load: 65, reps: 6, durationSec: null },
      { load: 70, reps: 5, durationSec: null },
    ]);
    expect(bench!.assumptions.join(' ')).toMatch(/weight × reps for each set/);
    expect(bench!.assumptions.join(' ')).toMatch(/No unit written for 60, 65, 70 — read as kg/);
    expect(incline).toMatchObject({ exerciseId: 'incline-db-press', loadType: null, suggestedLoadType: 'per-dumbbell' });
    expect(logged(incline!)).toEqual(sets(22.5, [10, 10, 8]));
    expect(fly!.values).toMatchObject({ sets: 3, repMin: 12, load: 15 });
  });

  it('one set per line ("Set 1: 100kg x 5") under a name: every set kept, in order', () => {
    const [dl, lat] = entries('setLinesInBlock');
    expect(parse('setLinesInBlock').days[0]!.heading).toBe('Monday – Pull');
    expect(dl!.exerciseId).toBe('deadlift');
    expect(logged(dl!)).toEqual([
      { load: 100, reps: 5, durationSec: null },
      { load: 110, reps: 5, durationSec: null },
      { load: 120, reps: 3, durationSec: null },
    ]);
    expect(lat!.exerciseId).toBe('lat-pulldown'); // "Lat pd"
    expect(logged(lat!).map((s) => [s.load, s.reps])).toEqual([
      [50, 12],
      [55, 10],
    ]);
  });

  it('"3x8 @ 60kg": sets × reps at a weight; "@ 40" takes the note’s unit and says so', () => {
    const [press, ext, curl] = entries('atLoad');
    expect(press!.values).toMatchObject({ sets: 3, repMin: 8, load: 60, unit: 'kg' });
    expect(ext!.values).toMatchObject({ sets: 3, repMin: 12, load: 40 });
    expect(ext!.assumptions.join(' ')).toMatch(/read as kg/);
    expect(curl!.values).toMatchObject({ sets: 3, repMin: 12, load: 35 });
  });

  it('RPE is kept as a note, never read as reps or a weight', () => {
    const [squat, rdl] = entries('rpe');
    expect(squat!.values).toMatchObject({ sets: 3, repMin: 5, load: 100 });
    expect(squat!.comments).toEqual(['RPE 8']);
    expect(rdl!.comments).toEqual(['RPE 7']);
    expect(rdl!.values).toMatchObject({ sets: 3, repMin: 8, load: 80 });
    expect(rdl!.uncertain).toContain('exercise'); // "RDL": barbell or dumbbell — asked
  });

  it('"40/42.5/45kg x 8/6/5": weights and reps paired per set', () => {
    const [ohp, lat] = entries('slashLoads');
    expect(ohp!.exerciseId).toBe('overhead-press');
    expect(logged(ohp!).map((s) => [s.load, s.reps])).toEqual([
      [40, 8],
      [42.5, 6],
      [45, 5],
    ]);
    expect(logged(lat!).map((s) => [s.load, s.reps])).toEqual([
      [10, 15],
      [12, 12],
      [12, 10],
    ]);
    expect(parseValues('20/22.5/25kg x 10/8').notes).toEqual(['20/22.5/25kg x 10/8']); // can't pair: kept, not guessed
  });

  it('pounds stay pounds; "(barbell)" picks the variation', () => {
    const [bench, fly] = entries('pounds');
    expect(bench).toMatchObject({ exerciseId: 'barbell-bench-press', unit: 'lb' });
    expect(logged(bench!).map((s) => s.load)).toEqual([135, 155, 185]);
    expect(fly).toMatchObject({ exerciseId: 'db-fly', unit: 'lb' });
  });

  it('bodyweight: "BW x 12, 10, 8" records reps with no load', () => {
    const [pull, dips, push] = entries('bodyweight');
    expect(pull).toMatchObject({ exerciseId: 'pull-up', loadType: 'bodyweight' });
    expect(logged(pull!)).toEqual(sets(null, [12, 10, 8]));
    expect(dips).toMatchObject({ name: 'Dips', loadType: 'bodyweight' });
    expect(push).toMatchObject({ exerciseId: 'bw-pushup', loadType: 'bodyweight' });
    expect(logged(push!)).toEqual(sets(null, [20, 18, 15]));
  });

  it('"+10kg" on pull-ups is added weight, not total', () => {
    const [pull, chin] = entries('addedLoad');
    expect(pull).toMatchObject({ exerciseId: 'pull-up', loadType: 'bodyweight-plus' });
    expect(pull!.values).toMatchObject({ load: 10, sets: 3, repMin: 6 });
    expect(chin).toMatchObject({ exerciseId: 'chin-up', loadType: 'bodyweight-plus' });
    expect(chin!.values).toMatchObject({ load: 5, sets: 3, repMin: 8 });
  });

  it('superset labels (A1/A2) are kept with each exercise', () => {
    const list = entries('supersetLabels');
    expect(list.map((e) => [e.name, e.comments[0]])).toEqual([
      ['Dumbbell biceps curl', 'A1'],
      ['Triceps pushdown', 'A2'],
      ['Hammer curl', 'B1'],
      ['Overhead dumbbell triceps extension', 'B2'],
    ]);
  });

  it('"Superset:" is a note for the day, never a new day; "SS:" before an exercise is kept with it', () => {
    const note = parse('supersetSS');
    expect(note.days).toHaveLength(1);
    expect(note.days[0]!.notes).toEqual(['Superset:']);
    const [lat, face, fly] = note.days[0]!.entries;
    expect(logged(lat!)).toEqual(sets(8, [15, 15, 12]));
    expect(face!.exerciseId).toBe('face-pull');
    expect(fly).toMatchObject({ exerciseId: 'cable-fly', comments: ['Superset'] });
  });

  it('warm-up sets are kept as notes, never recorded as working sets', () => {
    const [squat] = entries('warmUps');
    expect(squat!.exerciseId).toBe('barbell-back-squat');
    expect(squat!.comments).toEqual(['warmup 40x10', 'warm-up 60x5']);
    expect(logged(squat!).map((s) => [s.load, s.reps])).toEqual([
      [100, 5],
      [105, 5],
      [105, 4],
    ]);
    expect(squat!.assumptions.join(' ')).toMatch(/Warm-up kept as a note/);
  });

  it('drop sets are kept as notes, never added as sets', () => {
    const [lat, push] = entries('dropSets');
    expect(logged(lat!)).toEqual(sets(12, [12, 10, 9]));
    expect(lat!.comments).toEqual(['drop 6kg x 15']);
    expect(push!.values).toMatchObject({ sets: 3, repMin: 12, load: 30 });
    expect(push!.comments).toEqual(['Drop set: 15kg x 20']);
    expect(push!.assumptions.join(' ')).toMatch(/Drop set kept as a note/);
  });

  it('trailing comments ("felt easy") are kept as notes', () => {
    expect(entries('trailingComments').map((e) => e.comments)).toEqual([['felt easy'], ['go heavier next time'], ['(knee a bit sore)']]);
  });

  it('dates: a date without a year is never completed; a full date is used', () => {
    const note = parse('dateHeadings');
    expect(note.days.map((d) => [d.date, d.dateIncomplete, d.weekday])).toEqual([
      [null, 'Monday 12 Oct', 1],
      ['2026-10-14', null, 3],
    ]);
    const inHeading = parse('dateInHeading');
    expect(inHeading.days.map((d) => [d.heading, d.date])).toEqual([
      ['Push', '2026-11-02'],
      ['Legs', '2026-11-04'],
    ]);
  });

  it('"Week 3 Day 2 - Pull" is a heading; "seated row" is a library name', () => {
    const note = parse('weekDay');
    expect(note.days.map((d) => d.heading)).toEqual(['Week 3 Day 2 - Pull']);
    expect(note.days[0]!.entries.map((e) => e.exerciseId)).toEqual(['lat-pulldown', 'cable-row']);
  });

  it('tabs and repeated spaces are just spaces', () => {
    const [bench, lat] = entries('tabsAndSpaces');
    expect(bench!.values).toMatchObject({ sets: 3, repMin: 8, load: 30, loadType: 'per-side' });
    expect(logged(lat!)).toEqual(sets(45, [10, 10, 9]));
  });

  it('UPPERCASE names and units are read; an ambiguous name still asks', () => {
    const note = parse('uppercase');
    expect(note.days.map((d) => d.heading)).toEqual(['PUSH DAY']);
    const [bench, ohp, push] = note.days[0]!.entries;
    expect(bench!.uncertain).toContain('exercise');
    expect(bench!.values).toMatchObject({ sets: 5, repMin: 5, load: 80, unit: 'kg' });
    expect(ohp!.exerciseId).toBe('overhead-press');
    expect(push!.exerciseId).toBe('triceps-pushdown');
  });

  it('gym shorthand: OHP, RDL, BB, DB, lat pd, inc db press', () => {
    const list = entries('shorthand');
    expect(list.map((e) => e.exerciseId)).toEqual([null, 'lat-pulldown', 'db-rdl', 'incline-db-press']);
    expect(list[0]).toMatchObject({ name: 'BB row', known: false }); // no fuzzy guess
    expect(list[2]).toMatchObject({ loadType: 'per-dumbbell' }); // "each hand"
  });

  it('timed holds: "3 x 60s", "45s, 40s, 30s", "3x30 sec"', () => {
    const [plank, side, hang] = entries('timedHolds');
    expect(plank).toMatchObject({ loadType: 'timed' });
    expect(logged(plank!)).toEqual([60, 60, 60].map((d) => ({ load: null, reps: null, durationSec: d })));
    expect(logged(side!).map((s) => s.durationSec)).toEqual([45, 40, 30]);
    expect(logged(hang!).map((s) => s.durationSec)).toEqual([30, 30, 30]);
  });

  it('cardio: minutes are a duration; "2000m" is a distance kept as a note, never minutes', () => {
    const [tread, bike, rower] = entries('cardio');
    expect(tread).toMatchObject({ name: 'Treadmill', loadType: 'timed' });
    expect(tread!.values!.durationSec).toBe(1200);
    expect(bike!.values!.durationSec).toBe(600);
    expect(rower!.values!.durationSec).toBe(485); // 8:05
    expect(rower!.comments).toEqual(['2000 m']);
  });

  it('checklists (☐ ☑ - [ ] - [x]) are list markers', () => {
    expect(entries('checklist').map((e) => e.exerciseId)).toEqual(['smith-squat', 'leg-press', 'leg-curl', 'calf-raise']);
  });

  it('bullets (• ◦ * –) and emoji bullets are list markers', () => {
    expect(entries('bullets').map((e) => e.exerciseId)).toEqual(['smith-bench-press', 'cable-fly', 'lateral-raise', 'triceps-pushdown']);
    const emoji = parse('emoji');
    expect(emoji.days[0]!.heading).toBe('Arms day');
    expect(emoji.days[0]!.entries.map((e) => e.exerciseId)).toEqual(['db-hammer-curl', 'triceps-pushdown']);
  });

  it('a chat message: a number after "5x5" is read as the weight, said so, and the unit is asked', () => {
    const [squat, bench, pull] = entries('chatMessage');
    expect(squat!.values).toMatchObject({ sets: 5, repMin: 5, load: 100, unit: null });
    expect(squat!.assumptions).toContain('Read “100” as the weight.');
    expect(squat!.uncertain).toEqual(expect.arrayContaining(['unit', 'exercise']));
    expect(bench!.values).toMatchObject({ sets: 3, repMin: 8, load: 60 });
    expect(pull).toMatchObject({ exerciseId: 'pull-up', loadType: 'bodyweight' });
  });

  it('"3 sets of 10 with 24kg"; "each leg" is kept as a note', () => {
    const [goblet, lunge, thrust] = entries('setsOf');
    expect(goblet!.values).toMatchObject({ sets: 3, repMin: 10, load: 24 });
    expect(lunge).toMatchObject({ name: 'Walking lunges', comments: ['each leg'] });
    expect(lunge!.values).toMatchObject({ sets: 3, repMin: 12, load: null });
    expect(thrust!.values).toMatchObject({ sets: 3, repMin: 10, load: 80 });
  });

  it('"did 3 sets of 10 at 50kg" is a log; "felt heavy" stays a note', () => {
    const [machine, chest] = entries('didLog');
    expect(machine!.name).toBe('Bench press machine');
    expect(logged(machine!)).toEqual(sets(50, [10, 10, 10]));
    expect(chest!.comments).toEqual(['felt heavy']);
    expect(logged(chest!)).toEqual(sets(45, [12, 10, 9]));
  });

  it('"3x5x140kg" and "100x5x3": the weight is found, the reading is shown with a swap option', () => {
    const [dl, squat] = entries('triple');
    expect(dl!.values).toMatchObject({ sets: 3, repMin: 5, load: 140 });
    expect(dl!.assumptions[0]).toBe('Read “3x5x140kg” as 3 sets of 5 reps with 140 kg.');
    expect(squat!.values).toMatchObject({ sets: 3, repMin: 5, load: 100 });
  });

  it('"2 plates a side" is never converted to kg; "20 a side" asks for the unit', () => {
    const [smith, press] = entries('plates');
    expect(smith).toMatchObject({ loadType: 'per-side', unit: null });
    expect(smith!.uncertain).toContain('unit');
    expect(press!.values!.load).toBeNull();
    expect(press!.comments).toEqual(['2 plates a side']);
    expect(logged(press!)).toEqual(sets(null, [10, 10, 8]));
  });

  it('"# Upper" headings start days', () => {
    expect(parse('hashHeadings').days.map((d) => [d.heading, d.entries.length])).toEqual([
      ['Upper', 2],
      ['Lower', 2],
    ]);
  });

  it('a title and loose notes are kept as text', () => {
    const note = parse('titleAndNotes');
    expect(note.preamble).toEqual(['My PPL plan', 'Notes: progress weekly']);
    expect(note.days[0]!.heading).toBe('Push');
    expect(note.days[0]!.entries[0]!.comments).toEqual(['keep elbows tucked']);
    expect(note.days[0]!.notes).toEqual(['Bring water']);
  });

  it('"80kg for 10, 90kg for 8, 100kg for 6"', () => {
    expect(logged(entries('forPairs')[0]!).map((s) => [s.load, s.reps])).toEqual([
      [80, 10],
      [90, 8],
      [100, 6],
    ]);
  });

  it('lines that mean nothing are kept, flagged, and never become exercises', () => {
    const note = parse('junkLines');
    expect(note.days[0]!.entries.map((e) => e.name)).toEqual(['Smith machine bench press', 'Lat pulldown']);
    expect(note.unparsed.map((u) => u.raw)).toEqual(['12/']);
  });

  it('"Did 24kg for 10, 9, 8 with 2 RIR"', () => {
    const [e] = entries('didWithRir');
    expect(logged(e!)).toEqual(sets(24, [10, 9, 8]));
    expect(e!.comments).toEqual(['RIR 2']);
  });

  it('"12,5 kg" is 12.5 kg; "kilos" is kg', () => {
    const [curl, hammer] = entries('commaDecimal');
    expect(curl!.values).toMatchObject({ load: 12.5, unit: 'kg' });
    expect(hammer!.values).toMatchObject({ load: 10, unit: 'kg', reps: [12, 12, 10] });
  });
});

describe('Single-line rules', () => {
  it('"60x8" alone: more than 20 can’t be a set count, so it is weight × reps', () => {
    expect(parseValues('60x8')).toMatchObject({ load: 60, reps: [8], sets: null, unit: null, uncertain: ['unit'] });
    expect(parseValues('10x3')).toMatchObject({ sets: 3, repMin: 10 }); // unchanged reading, still flagged
  });

  it('"20m" is read as minutes and says so; "Rest 1:30" is 90 s', () => {
    expect(parseValues('20m').assumptions).toContain('Read “20m” as 20 minutes.');
    expect(parseValues('3x8 rest 1:30').restSec).toBe(90);
  });

  it('nothing is dropped: numbers that were not understood stay in the comment text', () => {
    expect(parseValues('20 min incline 12 speed 5').extraText).toBe('incline 12 speed 5');
  });

  it('performanceSets still returns [] when nothing performed was written', () => {
    expect(performanceSets(parseValues('3 x 8-12'), 'total')).toEqual([]);
    expect(performanceSets(null, 'total')).toEqual([]);
  });
});

describe('The user’s note in all three import modes', () => {
  const NOTE = CORPUS.userBlocks;
  /** The one-tap answers the user gives on the review screen. */
  const answers = { '0:0': { loadType: 'per-dumbbell' as const }, '0:2': { loadType: 'total' as const } };

  it('"Use as my workout plan": the plan (sets × reps, load, rest) — and what was done kept as a note', () => {
    const parsed = parseNote(NOTE, { defaultUnit: 'kg' });
    expect(importIssues(parsed, 'template', { date: null, undated: false }).filter((i) => i.blocking)).toEqual([]);
    const days = templateDays(parsed, ctx());
    const [db, lat, row] = days[0]!.exercises;
    expect([db, lat, row].map((e) => [e!.name, e!.sets, e!.repMin, e!.repMax, e!.restSec, e!.plannedLoad?.value])).toEqual([
      ['Dumbbell bench press', 4, 6, 6, 120, 27.5],
      ['Lat pulldown', 4, 6, 6, 120, 76],
      ['Chest Supported Row', 3, 8, 8, 90, 45],
    ]);
    expect(db!.notes.split('\n')).toEqual(['Logged: 27.5 kg/dumbbell × 7', 'Rest 2–3 min']);
    expect(lat!.notes.split('\n')).toEqual(['Logged: 76 kg × 8', 'Weighted if possible', 'RIR 1', 'Added 1 (no unit written, so not counted in the weight)']);
    expect(row!.notes).toBe('RIR 1'); // 3 × 8 at 45 is shown by the plan itself
  });

  it('"Add to my training history": exactly the logged sets; never a date it wasn’t given', () => {
    const parsed = resolveNote(parseNote(NOTE, { defaultUnit: 'kg' }), answers);
    // No date in the note: the user must choose one (or mark undated).
    expect(importIssues(parsed, 'history', { date: null, undated: false }).some((i) => i.blocking && /date/i.test(i.message))).toBe(true);
    const unresolved = parseNote(NOTE, { defaultUnit: 'kg' });
    expect(importIssues(unresolved, 'history', { date: '2026-11-02', undated: false }).filter((i) => i.blocking).map((i) => i.key)).toEqual(['0:0', '0:2']);
    expect(importIssues(parsed, 'history', { date: '2026-11-02', undated: false }).filter((i) => i.blocking)).toEqual([]);

    const out = historyRecords(parsed, { date: '2026-11-02', undated: false, hash: 'h', now: new Date('2026-11-09T10:00:00Z'), unit: 'kg' }, ctx());
    expect(out.sessions).toHaveLength(1);
    expect(out.sessions[0]!.completedLocalDate).toBe('2026-11-02');
    expect(out.sessions[0]!.exercises.map((x) => [x.name, x.loadType, x.sets.map((s) => [s.load, s.reps])])).toEqual([
      ['Dumbbell bench press', 'per-dumbbell', [[27.5, 7]]],
      ['Lat pulldown', 'total', [[76, 8]]],
      ['Chest Supported Row', 'total', [[45, 8], [45, 8], [45, 8]]],
    ]);

    const undated = historyRecords(parsed, { date: null, undated: true, hash: 'h', now: new Date('2026-11-09T10:00:00Z'), unit: 'kg' }, ctx());
    expect(undated.sessions).toEqual([]);
    expect(undated.undated.map((u) => u.sets.length)).toEqual([1, 1, 3]);
  });

  it('per-set weights reach history and this week’s sheet set by set', () => {
    const parsed = parseNote('12 Oct 2026\nBarbell bench 60kg x 8, 65kg x 6, 70kg x 5', { defaultUnit: 'kg' });
    const out = historyRecords(parsed, { date: null, undated: false, hash: 'h', now: new Date('2026-11-09T10:00:00Z'), unit: 'kg' }, ctx());
    expect(out.sessions[0]!.exercises[0]!.sets.map((s) => [s.load, s.reps])).toEqual([
      [60, 8],
      [65, 6],
      [70, 5],
    ]);
  });

  it('"Fill in this week’s update": logged values fill the matching exercises; nothing is marked done', () => {
    const c = ctx();
    const days = templateDays(parseNote(NOTE, { defaultUnit: 'kg' }), c);
    const programme = createProgramme(newIdFn, new Date('2026-11-01T10:00:00Z'), { name: 'Mine', goal: 'hypertrophy', days, daysPerWeek: 1 });
    const week = buildWeekDraft({ weekStart: '2026-11-09', programme, previousWeek: null, sessions: [], now: new Date('2026-11-09T10:00:00Z'), unit: 'kg', copy: false });
    const parsed = resolveNote(parseNote(NOTE, { defaultUnit: 'kg' }), answers);
    const { week: filled, matched, unmatched } = fillWeek(week, parsed, { ...c, custom: c.created });
    expect(matched).toBe(3);
    expect(unmatched).toEqual([]);
    const ex = filled.sessions[0]!.exercises;
    expect(ex.map((x) => [x.source, x.text])).toEqual([
      ['imported', '27.5 kg/dumbbell × 7'],
      ['imported', '76 kg × 8'],
      ['imported', '45 kg × 8, 8, 8'],
    ]);
    expect(filled.sessions.every((s) => s.status === 'not-recorded')).toBe(true);

    // Per-set weights become the weekly sheet's "a × 8; b × 6" form.
    const benchDays = templateDays(parseNote('Push\nBarbell bench 60kg 3x8'), c);
    const p2 = createProgramme(newIdFn, new Date('2026-11-01T10:00:00Z'), { name: 'P', goal: 'hypertrophy', days: benchDays, daysPerWeek: 1 });
    const w2 = buildWeekDraft({ weekStart: '2026-11-09', programme: p2, previousWeek: null, sessions: [], now: new Date('2026-11-09T10:00:00Z'), unit: 'kg', copy: false });
    const f2 = fillWeek(w2, parseNote('Push\nBarbell bench 60kg x 8, 65kg x 6, 70kg x 5'), c);
    expect(f2.week.sessions[0]!.exercises[0]!.text).toBe('60 kg × 8; 65 kg × 6; 70 kg × 5');
  });
});
