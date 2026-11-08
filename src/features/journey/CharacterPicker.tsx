import { CHARACTER_DEFS } from '../../content/characters';
import { Adventurer } from '../../ui/Adventurer';

/**
 * Character preview cards (radio group). Styles are cosmetic only and share
 * the same progression; art is original placeholder pixel art.
 */
export function CharacterPicker({ value, level, onChange, name = 'character' }: { value: string; level: number; onChange: (style: string) => void; name?: string }) {
  return (
    <fieldset className="field">
      <legend className="field-label">Choose your character</legend>
      <p className="field-hint">Purely cosmetic — every character levels up the same way. You can switch any time without losing XP or achievements.</p>
      <div className="char-grid" data-testid="character-picker">
        {CHARACTER_DEFS.map((d) => (
          <label key={d.id} className="char-card">
            <input type="radio" name={name} value={d.id} checked={value === d.id} onChange={() => onChange(d.id)} />
            <span className="char-body">
              <span className="scene-frame" style={{ width: 84, height: 84 }}>
                <Adventurer styleId={d.id} level={level} size={72} decorative />
              </span>
              <span className="strong small">{d.name}</span>
              <span className="xs muted">{d.tagline}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="xs faint">Placeholder pixel art drawn for AdaptFit — final artwork may change.</p>
    </fieldset>
  );
}
