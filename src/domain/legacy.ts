/**
 * V0.1 shapes (database v1/v2, backup format v1). Kept only so existing
 * records and backups can be migrated to the V0.2 model. Never write these.
 */
import type { Energy, EquipmentMode, ExerciseTag, Plan, SafetyConcern, Soreness, WeightUnit } from './types';

export interface LegacyProfile {
  id: 'me';
  goal: 'strength' | 'consistency' | 'general';
  experience: 'beginner' | 'intermediate' | 'advanced';
  equipment: EquipmentMode[];
  preferredMinutes: number;
  weightUnit: WeightUnit;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyCheckIn {
  localDate: string;
  availableMinutes: number;
  energy: Energy;
  soreness: Soreness;
  equipment: EquipmentMode[];
  safetyConcern: SafetyConcern | null;
  updatedAt: string;
}

export interface LegacyLoad {
  value: number;
  unit: WeightUnit;
}

export interface LegacySetEntry {
  id: string;
  itemKey: string;
  exerciseId: string;
  exerciseName: string;
  tags: ExerciseTag[];
  reps: number | null;
  durationSec: number | null;
  load: LegacyLoad | null;
  loggedAt: string;
  updatedAt: string;
}

export interface LegacySubstitution {
  itemKey: string;
  fromExerciseId: string;
  fromName: string;
  toExerciseId: string;
  toName: string;
  at: string;
}

export interface LegacySessionV2 {
  id: string;
  state: 'active' | 'completed' | 'discarded';
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  completedLocalDate: string | null;
  discardedAt: string | null;
  checkIn: LegacyCheckIn;
  recommendedPlan: Plan;
  plan: Plan;
  substitutions: LegacySubstitution[];
  sets: LegacySetEntry[];
  position: number;
  restStartedAt: string | null;
  restDurationSec: number | null;
}
