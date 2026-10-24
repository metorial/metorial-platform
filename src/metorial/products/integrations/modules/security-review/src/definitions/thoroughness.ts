import type { SecurityReviewThoroughness } from '@metorial-subspace/db';
import { reviewModels, type ReviewModel } from '@metorial/review-engine';

export type ThoroughnessTier = {
  model: ReviewModel;
  maxSteps: number;
  maxCostMicros: number;
  maxFixRounds: number;
};

export let thoroughnessTiers: Record<SecurityReviewThoroughness, ThoroughnessTier> = {
  basic: {
    model: reviewModels.fast,
    maxSteps: 10,
    maxCostMicros: 100_000,
    maxFixRounds: 2
  },
  standard: {
    model: reviewModels.balanced,
    maxSteps: 30,
    maxCostMicros: 750_000,
    maxFixRounds: 3
  },
  deep: {
    model: reviewModels.balanced,
    maxSteps: 60,
    maxCostMicros: 3_000_000,
    maxFixRounds: 3
  }
};

export let judgeModel = reviewModels.fast;

let thoroughnessLevels: SecurityReviewThoroughness[] = ['basic', 'standard', 'deep'];

export let parseThoroughness = (value: unknown) =>
  thoroughnessLevels.find(level => level == value);
