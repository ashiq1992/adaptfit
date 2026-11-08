export const GOAL_CHOICES = [
  { value: 'hypertrophy', label: 'Build muscle', hint: 'Hypertrophy focus' },
  { value: 'strength', label: 'Improve strength', hint: 'Strength focus' },
  { value: 'fat-loss', label: 'Lose fat', hint: 'Keep muscle while leaning out' },
  { value: 'recomposition', label: 'Body recomposition', hint: 'Lose fat, build muscle' },
  { value: 'general', label: 'General fitness', hint: 'A balanced mix' },
  { value: 'consistency', label: 'Improve consistency', hint: 'Show up more often' },
] as const;

export const EXPERIENCE_CHOICES = [
  { value: 'beginner', label: 'Beginner', hint: 'Under 6 months' },
  { value: 'intermediate', label: 'Intermediate', hint: '6 months – 3 years' },
  { value: 'advanced', label: 'Advanced', hint: '3+ years' },
] as const;
