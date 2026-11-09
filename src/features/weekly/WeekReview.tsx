import { useMemo } from 'react';
import { reviewWeek, type WeekReview } from '../../domain/performance';
import type { TrainingWeek } from '../../domain/types';
import { useApp } from '../../ui/DataContext';
import { weekLabel } from '../format';

export function useWeekReview(week: TrainingWeek | null): WeekReview | null {
  const { data } = useApp();
  return useMemo(() => (week && week.status === 'confirmed' ? reviewWeek({ week, sessions: data.sessions, recommendations: data.recommendations }) : null), [week, data.sessions, data.recommendations]);
}

/** "YOUR WEEKLY REVIEW" — short enough to read on a phone without scrolling much. */
export function WeekReviewCard({ week, review, actions, headingLevel = 2 }: { week: TrainingWeek; review: WeekReview; actions?: React.ReactNode; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const done = review.completed + review.partial;
  return (
    <section className="card review-card" aria-labelledby={`review-${week.weekStart}`} data-testid="week-review">
      <p className="eyebrow">Your weekly review</p>
      <H id={`review-${week.weekStart}`} className="card-title">
        {weekLabel(week.weekStart)}
      </H>
      <dl className="review-lines">
        <div>
          <dt>Training</dt>
          <dd data-testid="review-training">
            {done} of {review.planned} planned session{review.planned === 1 ? '' : 's'}
            {review.partial ? ` (${review.partial} partly)` : ''}
          </dd>
        </div>
        {review.lines.slice(0, 8).map((l) => (
          <div key={l.key}>
            <dt>{l.name}</dt>
            <dd className={l.kind === 'regression' ? 'attention-text' : l.kind === 'stable' || l.kind === 'insufficient' ? '' : 'positive-text'}>
              {l.kind === 'stable' ? 'Stable' : l.label}
              {l.isPR && <span className="pill pill-pr">Best</span>}
            </dd>
          </div>
        ))}
      </dl>
      {review.lines.length > 8 && <p className="xs muted">+{review.lines.length - 8} more exercises in Progress.</p>}
      <div className="coach-says">
        <p className="eyebrow">Coach</p>
        {review.summary.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>
      {review.lines.some((l) => l.detail && l.kind !== 'stable') && (
        <details className="disclosure">
          <summary>What changed exactly</summary>
          <ul className="stack-sm small">
            {review.lines
              .filter((l) => l.detail && l.kind !== 'stable')
              .map((l) => (
                <li key={l.key}>
                  <strong>{l.name}:</strong> {l.detail}
                </li>
              ))}
          </ul>
        </details>
      )}
      {actions}
    </section>
  );
}
