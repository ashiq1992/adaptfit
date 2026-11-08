import type { RpgState } from '../../domain/rpg';
import type { CharacterSelection } from '../../domain/types';
import { Adventurer } from '../../ui/Adventurer';
import { IconCalendar, IconCross, IconFlex, IconRunner, IconShield } from '../../ui/icons';

export const STAT_ICON = {
  str: <IconFlex size={14} />,
  end: <IconRunner size={14} />,
  rec: <IconCross size={13} />,
  cons: <IconCalendar size={14} />,
};

/** Compact character for Home and Progress: level, XP, and the four RPG stats. */
export function CharacterCard({ rpg, character, compact }: { rpg: RpgState; character: CharacterSelection; compact?: boolean }) {
  const { level } = rpg;
  return (
    <section className="hero-char" aria-label="Your character">
      <a href="#/journey" aria-label={`Open Journey — level ${level.level}, ${rpg.title}`} className="scene-frame" style={{ width: compact ? 88 : 104, height: compact ? 88 : 104 }}>
        <Adventurer styleId={character.style} hidden={character.hiddenLayers} level={level.level} size={compact ? 76 : 92} decorative />
      </a>
      <div className="stack-sm" style={{ minWidth: 0 }}>
        <div className="row between">
          <span className="level-badge">
            <IconShield size={20} /> Lv. <span className="num" data-testid="level">{level.level}</span>
          </span>
        </div>
        <span className="small strong">{rpg.title}</span>
        <div className="xp-bar" role="progressbar" aria-label="Experience toward next level" aria-valuemin={0} aria-valuemax={level.xpForNext} aria-valuenow={level.xpIntoLevel}>
          <span className="xp-fill" style={{ width: `${(level.xpIntoLevel / level.xpForNext) * 100}%` }} />
        </div>
        <span className="xs muted num" data-testid="xp-text">
          {level.xpIntoLevel.toLocaleString()} / {level.xpForNext.toLocaleString()} XP
        </span>
      </div>
      <div className="stat-chips">
        {rpg.stats.map((s) => (
          <div key={s.id} className="stat-chip" title={s.basis}>
            <span className={`abbr stat-${s.id}`}>
              {STAT_ICON[s.id]} {s.abbr}
            </span>
            <span className="val num">{s.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
