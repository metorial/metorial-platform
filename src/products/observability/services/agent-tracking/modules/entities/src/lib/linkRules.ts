import { isCustomKindKey } from './kinds';

export type LinkType = 'member_of' | 'part_of' | 'owned_by';

export type LinkOrigin = 'manual' | 'sync' | 'observed' | 'classifier';

export type LinkReach = 'from_now' | 'past_30_days';

export let linkTypes: LinkType[] = ['member_of', 'part_of', 'owned_by'];

export let linkOrigins: LinkOrigin[] = ['manual', 'sync', 'observed', 'classifier'];

export let linkReaches: LinkReach[] = ['from_now', 'past_30_days'];

let reachWindowMs = 30 * 24 * 60 * 60 * 1000;

type KindMatcher = string | 'custom:*';

type LinkRule = {
  type: LinkType;
  from: KindMatcher;
  to: KindMatcher;
  propagates: boolean | 'staffing';
};

export let linkRules: LinkRule[] = [
  { type: 'member_of', from: 'user', to: 'team', propagates: true },
  { type: 'member_of', from: 'user', to: 'cost_center', propagates: true },
  { type: 'member_of', from: 'user', to: 'custom:*', propagates: true },
  { type: 'member_of', from: 'user', to: 'project', propagates: 'staffing' },
  { type: 'part_of', from: 'team', to: 'team', propagates: true },
  { type: 'part_of', from: 'team', to: 'cost_center', propagates: true },
  { type: 'part_of', from: 'team', to: 'custom:*', propagates: true },
  { type: 'part_of', from: 'repo', to: 'project', propagates: true },
  { type: 'part_of', from: 'workspace', to: 'repo', propagates: true },
  { type: 'part_of', from: 'workspace', to: 'project', propagates: true },
  { type: 'part_of', from: 'project', to: 'cost_center', propagates: true },
  { type: 'part_of', from: 'project', to: 'custom:*', propagates: true },
  { type: 'part_of', from: 'custom:*', to: 'custom:*', propagates: true },
  { type: 'part_of', from: 'custom:*', to: 'cost_center', propagates: true },
  { type: 'part_of', from: 'agent', to: 'agent', propagates: false },
  { type: 'part_of', from: 'client_installation', to: 'device', propagates: false },
  { type: 'owned_by', from: 'device', to: 'user', propagates: false },
  { type: 'owned_by', from: 'client_user', to: 'user', propagates: false }
];

let matchesKind = (matcher: KindMatcher, kind: string) =>
  matcher == 'custom:*' ? isCustomKindKey(kind) : matcher == kind;

export let findLinkRule = (d: { type: string; fromKind: string; toKind: string }) =>
  linkRules.find(
    rule =>
      rule.type == d.type &&
      matchesKind(rule.from, d.fromKind) &&
      matchesKind(rule.to, d.toKind)
  );

export let isLinkAllowed = (d: { type: string; fromKind: string; toKind: string }) =>
  !!findLinkRule(d);

export let linkPropagates = (
  d: { type: string; fromKind: string; toKind: string },
  opts: { staffingPropagates?: boolean } = {}
) => {
  let rule = findLinkRule(d);
  if (!rule) return false;
  if (rule.propagates == 'staffing') return !!opts.staffingPropagates;

  return rule.propagates;
};

export let reachSince = (reach: LinkReach, now: Date = new Date()) =>
  reach == 'past_30_days' ? new Date(now.getTime() - reachWindowMs) : now;

export let reattributionWindowSince = (now: Date = new Date()) =>
  reachSince('past_30_days', now);
