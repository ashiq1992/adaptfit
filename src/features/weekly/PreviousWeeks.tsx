import { weekStartOf } from '../../domain/progression';
import { isCounted, weekCounts } from '../../domain/weekly';
import { useApp } from '../../ui/DataContext';
import { IconChevronRight } from '../../ui/icons';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { weekLabel } from '../format';

/** Earlier weeks, newest first. Each opens its record and review. */
export function PreviousWeeks() {
  const { data, today } = useApp();
  const thisWeek = weekStartOf(today);
  const weeks = [...data.trainingWeeks].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  return (
    <div className="screen">
      <ScreenHeader back={{ href: '#/plan', label: 'Plan' }} title="Previous weeks" subtitle="Confirmed weekly updates and drafts." />
      {weeks.length === 0 ? (
        <section className="card">
          <p className="muted">No weekly updates yet. Your first one starts from Plan → Update this week.</p>
          <a href="#/history" className="link-btn">
            See all recorded workouts
          </a>
        </section>
      ) : (
        <ul className="note-list">
          {weeks.map((w) => {
            const c = weekCounts(w);
            const done = w.sessions.filter(isCounted).length;
            return (
              <li key={w.weekStart}>
                <a href={w.weekStart === thisWeek ? '#/week' : `#/week/${w.weekStart}`} className="note-card">
                  <span className="note-card-body">
                    <span className="note-card-title">
                      {weekLabel(w.weekStart)}
                      <span className={`pill ${w.status === 'confirmed' ? 'pill-completed' : ''}`}>{w.status === 'confirmed' ? 'Confirmed' : 'Draft'}</span>
                    </span>
                    <span className="note-card-meta">
                      {done} of {c.planned} session{c.planned === 1 ? '' : 's'} done
                      {c.skipped ? ` · ${c.skipped} skipped` : ''}
                    </span>
                  </span>
                  <IconChevronRight />
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <a href="#/history" className="link-btn">
        All recorded workouts (including set-by-set logs)
      </a>
    </div>
  );
}
