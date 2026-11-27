import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import type { SlatesTriggerRoutingMatcher } from '@slates/proto';

export type PreparedMatcher = {
  hash: string;
  values: SlatesTriggerRoutingMatcher;
};

let hasIdentifyingValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value !== 'object') return true;
  return Object.values(value).some(hasIdentifyingValue);
};

export let prepareMatchers = async (
  matchers: SlatesTriggerRoutingMatcher[] | null | undefined
): Promise<PreparedMatcher[]> => {
  if (!matchers) return [];

  let byHash = new Map<string, SlatesTriggerRoutingMatcher>();

  for (let matcher of matchers) {
    if (!matcher || typeof matcher !== 'object' || Array.isArray(matcher)) continue;
    if (!hasIdentifyingValue(matcher)) continue;

    let hash = await Hash.sha256(canonicalize(matcher));
    if (!byHash.has(hash)) byHash.set(hash, matcher);
  }

  return [...byHash].map(([hash, values]) => ({ hash, values }));
};

export let matcherSetFingerprint = async (
  matchers: SlatesTriggerRoutingMatcher[] | null | undefined
) => {
  let prepared = await prepareMatchers(matchers);
  return prepared
    .map(matcher => matcher.hash)
    .sort()
    .join(':');
};
