import type { Organization, Project } from '@metorial/db';
import type { LocalRateLimitUsageKey } from './catalog';

export type RateLimitWindow = 'rate' | 'burst';

export interface RateLimitScope {
  organization: Pick<Organization, 'id' | 'oid'>;
  project: Pick<Project, 'id' | 'oid'>;
}

export interface RateLimitUsageInput {
  key: LocalRateLimitUsageKey;
  amount?: number;
}

export type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      key: LocalRateLimitUsageKey;
      window: RateLimitWindow;
      retryAfterMs: number;
      limit: { amount: number; intervalSeconds: number };
    };

export interface RateLimitProviderParams extends RateLimitScope {
  usages: RateLimitUsageInput[];
}

export interface RateLimitProvider {
  consume: (d: RateLimitProviderParams) => Promise<RateLimitResult>;
  check: (d: RateLimitProviderParams) => Promise<RateLimitResult>;
  refund: (d: RateLimitProviderParams) => Promise<void>;
}

export let allowAllRateLimitProvider: RateLimitProvider = {
  consume: async () => ({ allowed: true }),
  check: async () => ({ allowed: true }),
  refund: async () => {}
};

let rateLimitProviderRef = { current: allowAllRateLimitProvider };

export let setRateLimitProvider = (provider: RateLimitProvider) => {
  rateLimitProviderRef.current = provider;
};

export let getRateLimitProvider = () => rateLimitProviderRef.current;
