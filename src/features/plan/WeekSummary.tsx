import { useState } from 'react';
import { addDays } from '../../domain/dates';
import { weekShareText } from '../../domain/shareText';
import type { TrainingWeek } from '../../domain/types';
import { CopyDialog } from '../../ui/CopyDialog';
import { useApp } from '../../ui/DataContext';
import { IconClose } from '../../ui/icons';
import { useWeekReview } from '../weekly/WeekReview';
import { weekLabel } from '../format';

const DISMISS_KEY = (weekStart: string) => `adaptfit:summary-dismissed:${weekStart}`;

function isDismissed(weekStart: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY(weekStart)) === '1';
  } catch {
    return false;
  }
}

/** The most recent confirmed week, if it is this week or last week. */
export function summaryWeek(weeks: readonly TrainingWeek[], thisWeekStart: string): TrainingWeek | null {
  const from = addDays(thisWeekStart, -7);
  return (
    weeks
      .filter((w) => w.status === 'confirmed' && w.weekStart >= from && w.weekStart <= thisWeekStart)
      .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0] ?? null
  );
}

/**
 * Weekly summary on Plan, once a week is confirmed: sessions done, new bests,
 * what improved — with the full review and Share one tap away. Built only from
 * confirmed records (the same review as the weekly update).
 */
export function WeekSummary({ thisWeekStart }: { thisWeekStart: string }) {
  const { data } = useApp();
  const week = summaryWeek(data.trainingWeeks, thisWeekStart);
  const review = useWeekReview(week);
  const [hidden, setHidden] = useState(() => (week ? isDismissed(week.weekStart) : false));
  const [sharing, setSharing] = useState(false);
  if (!week || !review || hidden || (week && isDismissed(week.weekStart))) return null;
  const done = review.completed + review.partial;
  const bests = review.lines.filter((l) => l.isPR).map((l) => l.name);
  const improved = review.improved.filter((l) => !l.isPR).map((l) => l.name);
  const which = week.weekStart === thisWeekStart ? 'This week' : 'Last week';
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY(week.weekStart), '1');
    } catch {
      /* hidden for now only */
    }
    setHidden(true);
  };
  return (
    <section className="card week-summary" aria-labelledby="week-summary-title" data-testid="week-summary">
      <div className="row between">
        <p className="eyebrow">{which} in review</p>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Hide this summary" onClick={dismiss}>
          <IconClose size={18} />
        </button>
      </div>
      <h2 id="week-summary-title" className="card-title">
        {weekLabel(week.weekStart)}
      </h2>
      <ul className="week-summary-lines">
        <li>
          <span className="strong">
            {done} of {review.planned}
          </span>{' '}
          planned session{review.planned === 1 ? '' : 's'} done{review.partial ? ` (${review.partial} partly)` : ''}
        </li>
        {bests.length > 0 && (
          <li>
            <span className="pill pill-pr">{bests.length === 1 ? 'New best' : `${bests.length} new bests`}</span> {bests.slice(0, 3).join(', ')}
            {bests.length > 3 ? ` and ${bests.length - 3} more` : ''}
          </li>
        )}
        {improved.length > 0 && (
          <li>
            Improved: {improved.slice(0, 3).join(', ')}
            {improved.length > 3 ? ` and ${improved.length - 3} more` : ''}
          </li>
        )}
      </ul>
      {review.summary[review.summary.length - 1] && <p className="small muted">{review.summary[review.summary.length - 1]}</p>}
      <div className="row wrap">
        <a href={`#/week/${week.weekStart}`} className="btn btn-primary btn-sm">
          See review
        </a>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSharing(true)}>
          Share
        </button>
      </div>
      {sharing && <CopyDialog title="Share this week" label="Week as text" text={weekShareText(week, { footer: `Logged with AdaptFit · ${location.origin}${location.pathname}` })} onClose={() => setSharing(false)} />}
    </section>
  );
}
