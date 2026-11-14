import type { SecurityReviewScope, SecurityReviewThoroughness } from '@metorial-subspace/db';
import {
  createReviewModels,
  type ReviewModel,
  type ReviewModelAccess,
  type ReviewModelSet
} from '@metorial/review-engine';
import { env } from '../env';
import { redisModelRateLimiter } from '../lib/modelRateLimiter';

export type ThoroughnessTier = {
  model: ReviewModel;
  maxSteps: number;
  maxCostMicros: number;
  maxFixRounds: number;
};

let SLATE_MIN_COST_MICROS = 3_000_000;
let SLATE_MIN_STEPS = 1000;
let MODEL_RATE_LIMIT_MAX_WAIT_MS = 2 * 60 * 1000;
let USAGE_REVIEW_MAX_STEPS = 80;
let USAGE_REVIEW_MAX_COST_MICROS = 400_000;
let USAGE_REVIEW_MAX_FIX_ROUNDS = 2;

export let reviewModelAccess: ReviewModelAccess = {
  limiter: redisModelRateLimiter,
  maxWaitMs: MODEL_RATE_LIMIT_MAX_WAIT_MS
};

let reviewModels: ReviewModelSet | null = createReviewModels({
  cloudflare:
    env.models.CLOUDFLARE_AI_API_TOKEN && env.models.CLOUDFLARE_ACCOUNT_ID
      ? {
          accountId: env.models.CLOUDFLARE_ACCOUNT_ID,
          apiToken: env.models.CLOUDFLARE_AI_API_TOKEN
        }
      : undefined,
  vercel: env.models.AI_GATEWAY_API_KEY ? { apiKey: env.models.AI_GATEWAY_API_KEY } : undefined
});

if (!!env.models.CLOUDFLARE_AI_API_TOKEN != !!env.models.CLOUDFLARE_ACCOUNT_ID) {
  console.warn(
    'Security reviews: CLOUDFLARE_AI_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be set to use Cloudflare'
  );
}

export let isAiReviewAvailable = () => reviewModels !== null;

let requireModels = () => {
  if (!reviewModels)
    throw new Error('No AI model provider is configured for security reviews');
  return reviewModels;
};

let tierDefinitions: Record<
  SecurityReviewThoroughness,
  Omit<ThoroughnessTier, 'model'> & { model: keyof Pick<ReviewModelSet, 'fast' | 'balanced'> }
> = {
  basic: { model: 'fast', maxSteps: 40, maxCostMicros: 100_000, maxFixRounds: 2 },
  standard: { model: 'balanced', maxSteps: 350, maxCostMicros: 750_000, maxFixRounds: 3 },
  deep: { model: 'balanced', maxSteps: 60, maxCostMicros: 3_000_000, maxFixRounds: 3 }
};

export let getThoroughnessTier = (d: {
  thoroughness: SecurityReviewThoroughness;
  scope: SecurityReviewScope;
}): ThoroughnessTier => {
  let { model, ...tier } = tierDefinitions[d.thoroughness];

  return {
    ...tier,
    model: requireModels()[model],
    maxSteps: d.scope == 'global' ? Math.max(tier.maxSteps, SLATE_MIN_STEPS) : tier.maxSteps,
    maxCostMicros:
      d.scope == 'global'
        ? Math.max(tier.maxCostMicros, SLATE_MIN_COST_MICROS)
        : tier.maxCostMicros
  };
};

export let getUsageReviewTier = (): ThoroughnessTier => ({
  model: requireModels().balanced,
  maxSteps: USAGE_REVIEW_MAX_STEPS,
  maxCostMicros: USAGE_REVIEW_MAX_COST_MICROS,
  maxFixRounds: USAGE_REVIEW_MAX_FIX_ROUNDS
});

export let getJudgeModel = () => requireModels().fast;

let thoroughnessLevels: SecurityReviewThoroughness[] = ['basic', 'standard', 'deep'];

export let parseThoroughness = (value: unknown) =>
  thoroughnessLevels.find(level => level == value);
