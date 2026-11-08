import { useState } from 'react';
import { resolveStyle } from '../../content/characters';
import { saveProfile } from '../../data/repo';
import { type Achievement, nextUnlock, UNLOCKS, unlockedParts } from '../../domain/rpg';
import { Adventurer, HexBadge } from '../../ui/Adventurer';
import { useAnnounce } from '../../ui/Announcer';
import { clock } from '../../ui/clock';
import { Progress, Tabs } from '../../ui/controls';
import { useApp } from '../../ui/DataContext';
import { IconCalendar, IconCrown, IconDumbbellGlyph, IconGem, IconMoon, IconScroll, IconShield, IconStar, IconTrophy } from './glyphs';
import { STAT_ICON } from './CharacterCard';
import { shortDate } from '../format';
import { CharacterPicker } from './CharacterPicker';

const TABS = [
  { id: 'character', label: 'Character' },
  { id: 'select', label: 'Style' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'missions', label: 'Missions' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function JourneyScreen() {
  const { data } = useApp();
  const [tab, setTab] = useState<TabId>('character');
  if (!data.profile.gamification) {
    return (
      <div className="screen">
        <h1 tabIndex={-1}>Journey</h1>
        <section className="card">
          <h2 className="card-title">Gamification is off</h2>
          <p className="small muted">Your character, XP, achievements, and missions are hidden. Workout logging, history, and progress work exactly the same.</p>
          <a href="#/settings" className="btn btn-secondary">
            Turn it on in Settings
          </a>
        </section>
      </div>
    );
  }
  return (
    <div className="screen">
      <div className="screen-head">
        <h1 tabIndex={-1}>Journey</h1>
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Journey views" idBase="journey" />
      <div id="journey-panel" role="tabpanel" aria-labelledby={`journey-tab-${tab}`} className="stack">
        {tab === 'character' && <Character />}
        {tab === 'select' && <SelectCharacter onDone={() => setTab('character')} />}
        {tab === 'achievements' && <Achievements />}
        {tab === 'missions' && <Missions />}
      </div>
      <p className="xs faint">Character statistics are game values based on what you record in AdaptFit. They are not fitness or medical measurements.</p>
    </div>
  );
}

function Character() {
  const { rpg, data } = useApp();
  const ch = data.profile.character;
  const [openStat, setOpenStat] = useState<string | null>(null);
  const next = nextUnlock(rpg.level.level);
  const stat = rpg.stats.find((s) => s.id === openStat);
  const prs = rpg.events.filter((e) => e.kind === 'pr').slice(-5).reverse();
  const recent = rpg.events.slice(-6).reverse();
  return (
    <div className="grid-2">
      <div className="stack">
        <section className="scene" aria-labelledby="char-title">
          <div className="scene-frame" style={{ width: 'min(42vw, 176px)', height: 'min(42vw, 176px)' }}>
            <Adventurer styleId={ch.style} hidden={ch.hiddenLayers} level={rpg.level.level} size={160} label={`Your ${resolveStyle(ch.style).def.name.toLowerCase()} at level ${rpg.level.level}`} />
          </div>
          <div className="stack-sm" style={{ minWidth: 0 }}>
            <h2 id="char-title" className="title-line">
              {rpg.title}
            </h2>
            <span className="level-badge" style={{ fontSize: 'var(--fs-2xl)' }}>
              <IconShield size={24} /> Lv. <span className="num" data-testid="level">{rpg.level.level}</span>
            </span>
            <div className="xp-bar" role="progressbar" aria-label="Experience toward next level" aria-valuemin={0} aria-valuemax={rpg.level.xpForNext} aria-valuenow={rpg.level.xpIntoLevel}>
              <span className="xp-fill" style={{ width: `${(rpg.level.xpIntoLevel / rpg.level.xpForNext) * 100}%` }} />
            </div>
            <span className="xs muted num" data-testid="xp-text">
              {rpg.level.xpIntoLevel} / {rpg.level.xpForNext} XP · {rpg.level.totalXP} total
            </span>
          </div>
        </section>
        <div className="stat-tiles" role="group" aria-label="Character statistics">
          {rpg.stats.map((s) => (
            <button key={s.id} type="button" className="stat-tile" aria-expanded={openStat === s.id} aria-controls="stat-detail" onClick={() => setOpenStat((v) => (v === s.id ? null : s.id))} data-testid={`stat-${s.id}`}>
              <span className={`abbr stat-${s.id}`}>
                {STAT_ICON[s.id]} {s.abbr}
              </span>
              <span className="val">{s.value}</span>
              <span className="xs muted">{s.name}</span>
            </button>
          ))}
        </div>
        <div id="stat-detail" aria-live="polite">
          {stat && (
            <section className="card">
              <h3 className={`stat-${stat.id}`}>
                {stat.abbr} — {stat.name}: {stat.value}
              </h3>
              <p className="small muted">{stat.basis}</p>
              <ul className="bullet-list">
                {stat.contributors.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="xs faint">Every stat starts at 1. Missed workouts never reduce it.</p>
            </section>
          )}
        </div>
      </div>
      <div className="stack sticky-col">
        {next && (
          <section className="card card-amber">
            <span className="eyebrow">Next unlock</span>
            <div className="unlock">
              <div className="unlock-icon">
                <Adventurer styleId={ch.style} level={next.level} parts={new Set([...unlockedParts(rpg.level.level), next.id])} size={48} decorative />
              </div>
              <div className="stack-sm">
                <span className="strong">{next.name}</span>
                <span className="xs muted">Reach Lv. {next.level}</span>
                <Progress value={rpg.level.level} max={next.level} tone="amber" label={`Progress to ${next.name}`} />
              </div>
            </div>
          </section>
        )}
        <section className="card">
          <h2 className="card-title row">
            <IconTrophy size={20} /> Gym achievements
          </h2>
          {prs.length === 0 ? (
            <p className="small muted">Personal records on your lifts appear here. Your first session on an exercise sets the baseline.</p>
          ) : (
            <ul className="change-rows">
              {prs.map((e) => (
                <li key={e.key}>
                  <span className="small">{e.label.replace('Personal record: ', '')}</span>
                  <span className="pill pill-pr">PR · {shortDate(e.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="card-title">Recent XP</h2>
          {recent.length === 0 ? (
            <p className="small muted">Complete a workout to earn your first XP.</p>
          ) : (
            <ul className="change-rows">
              {recent.map((e) => (
                <li key={e.key}>
                  <span className="small">{e.label}</span>
                  <span className="amber small strong num">+{e.xp}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Preview a style, then confirm. Switching never changes XP, achievements, or workout history. */
function SelectCharacter({ onDone }: { onDone: () => void }) {
  const { data, rpg } = useApp();
  const announce = useAnnounce();
  const ch = data.profile.character;
  const [preview, setPreview] = useState(resolveStyle(ch.style).def.id as string);
  const [hidden, setHidden] = useState<string[]>(ch.hiddenLayers);
  const unlocked = UNLOCKS.filter((u) => u.id !== 'tunic' && rpg.level.level >= u.level);
  const def = resolveStyle(preview).def;
  const confirm = async () => {
    const now = clock.now().toISOString();
    await saveProfile({ ...data.profile, character: { ...ch, style: preview, hiddenLayers: hidden, updatedAt: now }, updatedAt: now });
    announce(`${def.name} selected. Your level, XP, and achievements are unchanged.`);
    onDone();
  };
  return (
    <div className="grid-2">
      <section className="card">
        <CharacterPicker value={preview} level={rpg.level.level} onChange={setPreview} name="journey-character" />
      </section>
      <section className="card sticky-col" aria-labelledby="preview-title" data-testid="character-preview">
        <h2 id="preview-title" className="card-title">
          Preview: {def.name}
        </h2>
        <div className="scene">
          <div className="scene-frame" style={{ width: 150, height: 150 }}>
            <Adventurer styleId={preview} hidden={hidden} level={rpg.level.level} size={136} label={`${def.name} preview at level ${rpg.level.level}`} />
          </div>
          <div className="stack-sm small">
            <span>
              Lv. <span className="num">{rpg.level.level}</span> · <span className="num">{rpg.level.totalXP}</span> XP
            </span>
            <span className="muted">{def.tagline}</span>
          </div>
        </div>
        {unlocked.length > 0 && (
          <fieldset className="field">
            <legend className="field-label">Show unlocked gear</legend>
            <div className="choices choices-chips">
              {unlocked.map((u) => (
                <label key={u.id} className="choice">
                  <input type="checkbox" checked={!hidden.includes(u.id)} onChange={(e) => setHidden(e.target.checked ? hidden.filter((h) => h !== u.id) : [...hidden, u.id])} />
                  <span className="choice-body">
                    <span className="choice-label">{u.name}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <p className="xs muted">Switching keeps your level, XP, stats, achievements, and history exactly as they are.</p>
        <div className="row wrap">
          <button type="button" className="btn btn-primary btn-grow" onClick={confirm} data-testid="confirm-character">
            Use {def.name}
          </button>
          <button type="button" className="btn btn-tertiary" onClick={onDone}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

const GLYPH: Record<Achievement['icon'], React.ReactNode> = {
  star: <IconStar />,
  dumbbell: <IconDumbbellGlyph />,
  calendar: <IconCalendar />,
  crown: <IconCrown />,
  shield: <IconShield />,
  moon: <IconMoon />,
  gem: <IconGem />,
  scroll: <IconScroll />,
};

function Achievements() {
  const { rpg } = useApp();
  const earned = rpg.achievements.filter((a) => a.earned).length;
  return (
    <section className="card">
      <div className="row between">
        <h2 className="card-title">Achievements</h2>
        <span className="pill num">
          {earned} / {rpg.achievements.length}
        </span>
      </div>
      <ul className="badge-grid">
        {rpg.achievements.map((a) => (
          <li key={a.id} className={`badge ${a.earned ? 'is-earned' : 'is-locked'}`} data-testid={`ach-${a.id}`}>
            <HexBadge earned={a.earned} rarity={a.rarity}>
              {GLYPH[a.icon]}
            </HexBadge>
            <span>{a.name}</span>
            <span className="xs faint num">{a.earned ? (a.rarity === 'rare' ? 'Rare' : 'Earned') : `${a.current}/${a.target}`}</span>
            <span className="visually-hidden">
              {a.description} {a.earned ? 'Earned.' : `Not yet earned, ${a.current} of ${a.target}.`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Missions() {
  const { rpg } = useApp();
  return (
    <section className="card">
      <h2 className="card-title">This week's missions</h2>
      <p className="xs muted">Optional. No streak pressure — unfinished missions simply reset next week.</p>
      <ul className="stack">
        {rpg.missions.map((m) => (
          <li key={m.id} className="stack-sm" data-testid={`mission-${m.id}`}>
            <div className="row between">
              <span className="small strong">{m.name}</span>
              <span className={`pill ${m.done ? 'pill-completed' : 'pill-mission'} num`}>{m.done ? 'Done' : `${m.current}/${m.target}`}</span>
            </div>
            <Progress value={m.current} max={m.target} label={m.name} />
          </li>
        ))}
      </ul>
    </section>
  );
}
