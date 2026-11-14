import { createHash } from 'node:crypto';
import {
  reachableEntities,
  type GraphLink,
  type ReachedEntity
} from '@mtsrc/agent-tracking-module-entities';
import { customKindPrefix } from '@mtsrc/agent-tracking-module-entities';
import { normalizeEmail } from '@mtsrc/agent-tracking-module-entities';
import { evaluateMatch } from '@mtsrc/agent-tracking-rule-match';
import type { AttributionEntry, AttributionSource } from '@mtsrc/agent-tracking-store';
import { buildSessionFacts } from './facts';
import type {
  AttributionEntity,
  AttributionSession,
  ResolveAttributionInput,
  ResolvedAttribution
} from './types';
import { ATTRIBUTION_VERSION } from '@mtsrc/agent-tracking-layers';

let maxPruneRounds = 5;

export let sourcePrecedence: AttributionSource[] = [
  'manual',
  'credential',
  'tag',
  'observed',
  'rule',
  'derived',
  'classifier'
];

// When single-valued derivations disagree (a team and a project lead to different cost
// centers), the path through the earliest kind here wins (07 §3.3: project before team).
let derivedViaOrder = ['project', 'repo', 'workspace', customKindPrefix, 'team', 'user'];

let senderKinds = new Set(['user', 'device']);

let tagKeyPrefix = 'metorial.';
let customTagPrefix = 'custom.';
let initiatorTagKey = 'metorial.initiator';

type Candidate = {
  kind: string;
  entityId: string;
  source: AttributionSource;
  priority?: number;
  confidence?: number;
  weight?: number;
  via?: string[];
  ruleId?: string;
  startPrecedence?: number;
  hops?: number;
};

let precedenceOf = (source: AttributionSource) => sourcePrecedence.indexOf(source);

export let tagKindKey = (key: string) => {
  let normalized = key.trim().toLowerCase();
  if (!normalized.startsWith(tagKeyPrefix) || normalized == initiatorTagKey) return null;

  let rest = normalized.slice(tagKeyPrefix.length);
  if (rest.startsWith(customTagPrefix)) {
    return `${customKindPrefix}${rest.slice(customTagPrefix.length)}`;
  }

  return rest || null;
};

export let slugKey = (kind: string, slug: string) =>
  `${kind}\u0000${slug.trim().toLowerCase()}`;

export let isEntityInScope = (
  entity: Pick<AttributionEntity, 'scopeProjectId' | 'scopeInstanceId'>,
  scope: { projectId: string; instanceId: string }
) =>
  (!entity.scopeProjectId || entity.scopeProjectId == scope.projectId) &&
  (!entity.scopeInstanceId || entity.scopeInstanceId == scope.instanceId);

let isLive = (entity: AttributionEntity) =>
  entity.status == 'managed' || entity.status == 'discovered';

let viaRank = (via: string[] | undefined, entities: Map<string, AttributionEntity>) => {
  let ranks = (via ?? []).map(id => {
    let kind = entities.get(id)?.kind ?? '';
    let index = derivedViaOrder.findIndex(prefix =>
      prefix == customKindPrefix ? kind.startsWith(prefix) : prefix == kind
    );
    return index < 0 ? derivedViaOrder.length : index;
  });

  return ranks.length ? Math.min(...ranks) : derivedViaOrder.length;
};

let compareCandidates =
  (entities: Map<string, AttributionEntity>) => (a: Candidate, b: Candidate) => {
    let precedence = precedenceOf(a.source) - precedenceOf(b.source);
    if (precedence) return precedence;

    if (a.source == 'rule') {
      let priority = (b.priority ?? 0) - (a.priority ?? 0);
      if (priority) return priority;
    }

    if (a.source == 'derived') {
      let start = (a.startPrecedence ?? 0) - (b.startPrecedence ?? 0);
      if (start) return start;

      let via = viaRank(a.via, entities) - viaRank(b.via, entities);
      if (via) return via;

      let hops = (a.hops ?? 0) - (b.hops ?? 0);
      if (hops) return hops;
    }

    let confidence = (b.confidence ?? 1) - (a.confidence ?? 1);
    if (confidence) return confidence;

    return a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0;
  };

// How many entities of the same kind lie between the session and this entry: a team reached
// through its subteam has depth 1. Grouping by a kind reads depth 0 so levels don't mix (11 §7).
export let entryDepth = (
  candidate: Pick<Candidate, 'kind' | 'via'>,
  entities: Map<string, Pick<AttributionEntity, 'kind'>>
) => (candidate.via ?? []).filter(id => entities.get(id)?.kind == candidate.kind).length;

let toEntry = (
  candidate: Candidate,
  weight: number,
  entities: Map<string, AttributionEntity>
): AttributionEntry => ({
  kind: candidate.kind,
  entityId: candidate.entityId,
  source: candidate.source,
  weight: Math.round(weight * 1e6) / 1e6,
  ...(entryDepth(candidate, entities) ? { depth: entryDepth(candidate, entities) } : {}),
  ...(candidate.confidence !== undefined ? { confidence: candidate.confidence } : {}),
  ...(candidate.via?.length ? { via: candidate.via } : {}),
  ...(candidate.ruleId ? { ruleId: candidate.ruleId } : {})
});

let scopedLinks = (
  links: GraphLink[],
  entities: Map<string, AttributionEntity>,
  session: AttributionSession
) =>
  links.filter(link =>
    [link.fromId, link.toId].every(id => {
      let entity = entities.get(id);
      return !!entity && isLive(entity) && isEntityInScope(entity, session);
    })
  );

let derive = (d: {
  starts: Map<string, number>;
  links: GraphLink[];
  at: Date;
  staffingPropagates?: boolean;
}): Candidate[] =>
  reachableEntities([...d.starts.keys()], d.links, d.at, {
    staffingPropagates: d.staffingPropagates
  }).map((reached: ReachedEntity) => ({
    kind: reached.kind,
    entityId: reached.entityId,
    source: 'derived',
    weight: reached.weight,
    via: reached.via,
    hops: reached.hops,
    startPrecedence: d.starts.get(reached.startId) ?? precedenceOf('observed')
  }));

let initiatorEntry = (input: ResolveAttributionInput): AttributionEntry | null => {
  let { session, entities, emails } = input;

  let device = session.observed.deviceId ? entities.get(session.observed.deviceId) : undefined;
  let ciDevice = device?.source == 'ephemeral';

  let tag = session.context.tags.find(
    tag =>
      tag.k.trim().toLowerCase() == initiatorTagKey &&
      (tag.origin == 'source' || (tag.origin == 'environment' && ciDevice))
  );
  if (!tag) return null;

  let userId = emails.get(normalizeEmail(tag.v));
  if (!userId || userId == session.observed.userId) return null;

  return { kind: 'user', entityId: userId, role: 'initiator', source: 'tag', weight: 1 };
};

let baseCandidates = (input: ResolveAttributionInput): Candidate[] => {
  let { session, kinds, slugs } = input;
  let candidates: Candidate[] = [];

  for (let manual of session.manual ?? []) {
    if (manual.entityId) {
      candidates.push({ kind: manual.kind, entityId: manual.entityId, source: 'manual' });
    }
  }

  if (session.observed.agentId) {
    candidates.push({
      kind: 'agent',
      entityId: session.observed.agentId,
      source: input.credentialAgent ? 'credential' : 'observed'
    });
  }

  for (let tag of session.context.tags) {
    let kindKey = tagKindKey(tag.k);
    let kind = kindKey ? kinds.get(kindKey) : undefined;
    if (!kind || senderKinds.has(kind.key) || !kind.tagOrigins.includes(tag.origin)) continue;

    let entityId = slugs.get(slugKey(kind.key, tag.v));
    if (entityId) candidates.push({ kind: kind.key, entityId, source: 'tag' });
  }

  let observed: [string, string[]][] = [
    ['client_user', session.observed.clientUserIds],
    ['client_installation', session.observed.clientInstallationIds],
    ['repo', session.context.repoIds],
    ['workspace', session.context.workspaceIds]
  ];

  for (let [kind, ids] of observed) {
    for (let entityId of ids) candidates.push({ kind, entityId, source: 'observed' });
  }

  return candidates;
};

let ruleDecisions = (
  input: ResolveAttributionInput,
  preRule: Candidate[],
  links: GraphLink[]
) => {
  let { session, entities } = input;

  let starts = startsOf(input, preRule);
  let teamIds = [
    ...new Set([
      ...preRule.filter(candidate => candidate.kind == 'team').map(c => c.entityId),
      ...derive({
        starts,
        links,
        at: session.startedAt,
        staffingPropagates: input.staffingPropagates
      })
        .filter(candidate => candidate.kind == 'team')
        .map(candidate => candidate.entityId)
    ])
  ];

  let facts = buildSessionFacts({ session, entities, teamIds });

  let ordered = [...input.rules].sort(
    (a, b) =>
      b.priority - a.priority ||
      (a.effect == b.effect ? 0 : a.effect == 'exclude' ? -1 : 1) ||
      (a.id < b.id ? -1 : 1)
  );

  let decided = new Set<string>();
  let assigned: Candidate[] = [];
  let excluded = new Set<string>();
  let matchedRuleIds: string[] = [];

  for (let rule of ordered) {
    if (session.startedAt.getTime() < rule.validFrom.getTime()) continue;
    if (rule.scopeProjectId && rule.scopeProjectId != session.projectId) continue;
    if (rule.scopeInstanceId && rule.scopeInstanceId != session.instanceId) continue;
    if (!evaluateMatch(rule.match, facts)) continue;

    matchedRuleIds.push(rule.id);
    if (decided.has(rule.targetId)) continue;
    decided.add(rule.targetId);

    if (rule.effect == 'exclude') {
      excluded.add(rule.targetId);
      continue;
    }

    let target = entities.get(rule.targetId);
    if (!target) continue;

    assigned.push({
      kind: target.kind,
      entityId: target.id,
      source: 'rule',
      priority: rule.priority,
      ruleId: rule.id
    });
  }

  return { assigned, excluded, matchedRuleIds };
};

let startsOf = (input: ResolveAttributionInput, candidates: Candidate[]) => {
  let starts = new Map<string, number>();

  let add = (id: string, precedence: number) => {
    let current = starts.get(id);
    if (current === undefined || precedence < current) starts.set(id, precedence);
  };

  if (input.session.observed.userId)
    add(input.session.observed.userId, precedenceOf('observed'));
  for (let candidate of candidates) add(candidate.entityId, precedenceOf(candidate.source));

  return starts;
};

let pickPerKind = (
  candidates: Candidate[],
  input: ResolveAttributionInput
): Map<string, { candidate: Candidate; weight: number }[]> => {
  let compare = compareCandidates(input.entities);
  let byKind = new Map<string, Candidate[]>();

  for (let candidate of candidates) {
    let list = byKind.get(candidate.kind) ?? [];
    list.push(candidate);
    byKind.set(candidate.kind, list);
  }

  let picked = new Map<string, { candidate: Candidate; weight: number }[]>();

  for (let [kind, list] of byKind) {
    let sorted = [...list].sort(compare);

    if (input.kinds.get(kind)?.cardinality != 'multi') {
      picked.set(kind, [{ candidate: sorted[0]!, weight: 1 }]);
      continue;
    }

    let best = new Map<string, Candidate>();
    for (let candidate of sorted) {
      if (!best.has(candidate.entityId)) best.set(candidate.entityId, candidate);
    }

    let chosen = [...best.values()];
    let raw = chosen.map(candidate =>
      candidate.source == 'derived' ? (candidate.weight ?? 1) : 1
    );
    let total = raw.reduce((sum, weight) => sum + weight, 0);
    let scale = total > 1 ? 1 / total : 1;

    picked.set(
      kind,
      chosen.map((candidate, index) => ({ candidate, weight: raw[index]! * scale }))
    );
  }

  return picked;
};

let kindOrder = (kind: string) => (kind == 'user' ? 0 : kind == 'device' ? 1 : 2);

let hashOf = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);

export let resolveAttribution = (input: ResolveAttributionInput): ResolvedAttribution => {
  let { session, entities } = input;

  let links = scopedLinks(input.links, entities, session);

  let isUsable = (candidate: Candidate) => {
    let entity = entities.get(candidate.entityId);
    return (
      !!entity &&
      isLive(entity) &&
      entity.kind == candidate.kind &&
      !senderKinds.has(candidate.kind) &&
      input.kinds.has(candidate.kind) &&
      isEntityInScope(entity, session)
    );
  };

  let suppressed = new Set(
    (session.manual ?? [])
      .filter(manual => manual.entityId === null)
      .map(manual => manual.kind)
  );

  let preRule = baseCandidates(input).filter(isUsable);

  let rules = input.sessionless
    ? { assigned: [], excluded: new Set<string>(), matchedRuleIds: [] }
    : ruleDecisions(input, preRule, links);

  let direct = [...preRule, ...rules.assigned.filter(isUsable)];
  let derived = derive({
    starts: startsOf(input, direct),
    links,
    at: session.startedAt,
    staffingPropagates: input.staffingPropagates
  }).filter(candidate => isUsable(candidate) && !senderKinds.has(candidate.kind));

  let all = [...direct, ...derived];

  let candidates = all.filter(
    candidate =>
      !(
        (candidate.source == 'rule' || candidate.source == 'derived') &&
        rules.excluded.has(candidate.entityId)
      ) &&
      (!suppressed.has(candidate.kind) || candidate.source == 'manual')
  );

  // A derivation that runs through an entity that didn't make it into the result (it lost its
  // single-valued kind, its kind was cleared, or a rule excluded it) must not count, so those
  // paths are pruned until nothing changes.
  let picked = pickPerKind(candidates, input);

  for (let round = 0; round < maxPruneRounds; round++) {
    let chosen = new Set(
      [...picked.values()].flatMap(list => list.map(item => item.candidate.entityId))
    );
    let blocked = new Set(
      [
        ...rules.excluded,
        ...all
          .filter(
            candidate =>
              input.kinds.get(candidate.kind)?.cardinality != 'multi' ||
              suppressed.has(candidate.kind)
          )
          .map(candidate => candidate.entityId)
      ].filter(id => !chosen.has(id))
    );

    let pruned = candidates.filter(
      candidate => candidate.source != 'derived' || !candidate.via?.some(id => blocked.has(id))
    );
    if (pruned.length == candidates.length) break;

    candidates = pruned;
    picked = pickPerKind(candidates, input);
  }

  let classifierResults = input.sessionless ? [] : (session.classification?.results ?? []);

  for (let result of classifierResults) {
    if (!result.accepted || picked.has(result.kind) || suppressed.has(result.kind)) continue;

    let candidate: Candidate = {
      kind: result.kind,
      entityId: result.accepted.entityId,
      source: 'classifier',
      confidence: result.accepted.confidence
    };
    if (!isUsable(candidate) || rules.excluded.has(candidate.entityId)) continue;

    picked.set(result.kind, [{ candidate, weight: 1 }]);
  }

  let entries: AttributionEntry[] = [];

  if (session.observed.userId) {
    entries.push({
      kind: 'user',
      entityId: session.observed.userId,
      role: 'principal',
      source: 'observed',
      weight: 1
    });
  }

  let initiator = input.sessionless ? null : initiatorEntry(input);
  if (initiator) entries.push(initiator);

  if (session.observed.deviceId) {
    entries.push({
      kind: 'device',
      entityId: session.observed.deviceId,
      source: 'observed',
      weight: 1
    });
  }

  let resolved = [...picked.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([, list]) =>
      [...list]
        .sort((a, b) =>
          a.candidate.entityId < b.candidate.entityId
            ? -1
            : a.candidate.entityId > b.candidate.entityId
              ? 1
              : 0
        )
        .map(item => toEntry(item.candidate, item.weight, input.entities))
    );

  entries.push(...resolved);
  entries.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind));

  let dimIds = [
    ...new Set([
      ...entries.map(entry => entry.entityId),
      session.projectId,
      session.instanceId
    ])
  ];

  let resolvedKinds = new Set(entries.map(entry => entry.kind));
  let fullyAttributed = input.managedKinds.every(kind => resolvedKinds.has(kind));

  return {
    entries,
    dimIds,
    fullyAttributed,
    matchedRuleIds: rules.matchedRuleIds,
    inputsHash: hashOf({ version: ATTRIBUTION_VERSION, entries, fullyAttributed })
  };
};

export let entriesToDims = (entries: AttributionEntry[]) =>
  entries
    .filter(entry => !senderKinds.has(entry.kind))
    .map(entry => ({
      kind: entry.kind,
      id: entry.entityId,
      w: entry.weight,
      ...(entry.depth ? { d: entry.depth } : {})
    }));
