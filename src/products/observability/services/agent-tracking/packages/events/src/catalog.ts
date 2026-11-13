import type { RebuildImpact } from '@mtsrc/agent-tracking-layers';

export type ScopeChange = 'upserted' | 'archived';

export type ReattributionRequest = {
  organizationId: string;
  since: Date;
  entityIds?: string[];
  ruleIds?: string[];
  scope?: { projectId?: string; instanceId?: string };
};

export type EntityIdentifierRef = { kind: string; type: string; value: string };

export type AgentTrackingEvents = {
  'scope.organization.changed:after': { organizationId: string; change: ScopeChange };
  'scope.project.changed:after': {
    organizationId: string;
    projectId: string;
    instanceIds: string[];
    change: ScopeChange;
  };
  'scope.instance.changed:after': {
    organizationId: string;
    instanceId: string;
    change: ScopeChange;
  };

  // Link and membership changes pass the entities they touched; kind and rule changes pass none,
  // which re-attributes every session of the scope that started since `since` (07 §6.2).
  'entities.links.changed:after': ReattributionRequest;
  'entities.kind.changed:after': ReattributionRequest;
  'entities.entity.merged:after': {
    organizationId: string;
    winnerId: string;
    loserId: string;
    tokenPrefixes: string[];
  };
  'entities.identifiers.released:after': {
    organizationId: string;
    identifiers: EntityIdentifierRef[];
  };
  'rules.rule.changed:after': ReattributionRequest;

  'sessions.session.turn_completed:after': { sessionKey: string };
  'sessions.session.idle:after': { sessionKeys: string[] };
  'knowledge.catalog.changed:after': { impacts: RebuildImpact[] };
  'knowledge.price_override.changed:after': {
    organizationId: string;
    projectId: string | null;
    impacts: RebuildImpact[];
  };
};

export let reattributionEvents = [
  'entities.links.changed:after',
  'entities.kind.changed:after',
  'rules.rule.changed:after'
] as const satisfies (keyof AgentTrackingEvents)[];
