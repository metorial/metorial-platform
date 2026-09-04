import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import type { SlatesTriggerRoutingMatcher } from '@slates/proto';

export type PreparedMatcher = {
  hash: string;
  values: SlatesTriggerRoutingMatcher;
};

let hasMatcherValues = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') return value !== undefined;
  return Object.values(value).some(hasMatcherValues);
};

export let prepareMatchers = async (
  matchers: SlatesTriggerRoutingMatcher[] | null | undefined
): Promise<PreparedMatcher[]> => {
  if (!matchers) return [];

  let byHash = new Map<string, SlatesTriggerRoutingMatcher>();

  for (let matcher of matchers) {
    if (!matcher || typeof matcher !== 'object') continue;
    if (!hasMatcherValues(matcher)) continue;

    let hash = await Hash.sha256(canonicalize(matcher));
    if (!byHash.has(hash)) byHash.set(hash, matcher);
  }

  return [...byHash].map(([hash, values]) => ({ hash, values }));
};
