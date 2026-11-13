import {
  buildResolveInput,
  loadAttributionInputs,
  toAttributionSession
} from '@mtsrc/agent-tracking-module-attribution';
import { resolveAttribution } from '@mtsrc/agent-tracking-module-attribution';
import type {
  AttributionEntity,
  AttributionRuleDefinition
} from '@mtsrc/agent-tracking-module-attribution';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import type { AttributionEntry } from '@mtsrc/agent-tracking-store';

let testWindowMs = 30 * 24 * 60 * 60 * 1000;
let maxTestedSessions = 5000;
let maxSamples = 20;

export let draftRuleId = 'draft';

export type RuleTestResult = {
  sessionsEvaluated: number;
  sessionsMatched: number;
  sessionsChanged: number;
  truncated: boolean;
  samples: {
    sessionKey: string;
    startedAt: Date;
    added: AttributionEntry[];
    removed: AttributionEntry[];
  }[];
};

let entryKey = (entry: AttributionEntry) =>
  `${entry.kind}\u0000${entry.entityId}\u0000${entry.source}\u0000${entry.weight}`;

let difference = (from: AttributionEntry[], other: AttributionEntry[]) => {
  let keys = new Set(other.map(entryKey));
  return from.filter(entry => !keys.has(entryKey(entry)));
};

export let testRuleDraft = async (d: {
  organizationId: string;
  draft: Omit<AttributionRuleDefinition, 'validFrom'>;
  target: AttributionEntity;
  replacesRuleId?: string;
  now?: Date;
}): Promise<RuleTestResult> => {
  let empty = {
    sessionsEvaluated: 0,
    sessionsMatched: 0,
    sessionsChanged: 0,
    truncated: false,
    samples: []
  };
  if (!isStoreConfigured()) return empty;

  let store = getStore();
  await store.ready();

  let now = d.now ?? new Date();
  let windowStart = new Date(now.getTime() - testWindowMs);

  let sessions = await store
    .collections()
    .sessions.find({
      organizationId: d.organizationId,
      startedAt: { $gte: windowStart, $lte: now },
      ...(d.draft.scopeProjectId ? { projectId: d.draft.scopeProjectId } : {}),
      ...(d.draft.scopeInstanceId ? { instanceId: d.draft.scopeInstanceId } : {})
    })
    .sort({ startedAt: -1 })
    .limit(maxTestedSessions)
    .toArray();
  if (!sessions.length) return empty;

  let attributionSessions = sessions.map(toAttributionSession);
  let loaded = await loadAttributionInputs({
    organizationId: d.organizationId,
    sessions: attributionSessions
  });
  loaded.entities.set(d.target.id, d.target);

  let baseline = loaded.context.rules;
  let withDraft = [
    ...baseline.filter(rule => rule.id != d.replacesRuleId),
    { ...d.draft, validFrom: windowStart }
  ];

  let result: RuleTestResult = { ...empty, truncated: sessions.length == maxTestedSessions };

  for (let [index, session] of attributionSessions.entries()) {
    let before = resolveAttribution(
      await buildResolveInput({ loaded, session, rules: baseline })
    );
    let after = resolveAttribution(
      await buildResolveInput({ loaded, session, rules: withDraft })
    );

    result.sessionsEvaluated++;
    if (after.matchedRuleIds.includes(d.draft.id)) result.sessionsMatched++;

    let added = difference(after.entries, before.entries);
    let removed = difference(before.entries, after.entries);
    if (!added.length && !removed.length) continue;

    result.sessionsChanged++;
    if (result.samples.length < maxSamples) {
      result.samples.push({
        sessionKey: sessions[index]!._id,
        startedAt: session.startedAt,
        added,
        removed
      });
    }
  }

  return result;
};
