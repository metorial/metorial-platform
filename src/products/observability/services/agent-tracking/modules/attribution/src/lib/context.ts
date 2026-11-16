import type { Organization, Prisma } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import type { GraphLink } from '@mtsrc/agent-tracking-module-entities';
import {
  isCustomerManagedKind,
  mergeKindDefinitions
} from '@mtsrc/agent-tracking-module-entities';
import { normalizeEmail } from '@mtsrc/agent-tracking-module-entities';
import type { SessionDocument } from '@mtsrc/agent-tracking-store';
import { slugKey, tagKindKey } from './resolver';
import type {
  AttributionEntity,
  AttributionKind,
  AttributionRuleDefinition,
  AttributionSession,
  ResolveAttributionInput
} from './types';

let contextTtlMs = 30_000;
let cachedLinkWindowMs = 35 * 24 * 60 * 60 * 1000;

let initiatorTagKey = 'metorial.initiator';

export let attributionEntitySelect = {
  id: true,
  kind: true,
  status: true,
  slug: true,
  source: true,
  scopeProject: { select: { id: true } },
  scopeInstance: { select: { id: true } }
} satisfies Prisma.EntitySelect;

type SelectedEntity = Prisma.EntityGetPayload<{ select: typeof attributionEntitySelect }>;

export type OrganizationAttributionContext = {
  organization: Organization;
  kinds: Map<string, AttributionKind>;
  rules: AttributionRuleDefinition[];
  managedKinds: string[];
  entities: Map<string, AttributionEntity>;
  recentLinks: { from: Date; links: GraphLink[] };
};

export let toAttributionEntity = (
  entity: SelectedEntity,
  identifiers: { type: string; value: string }[] = []
): AttributionEntity => ({
  id: entity.id,
  kind: entity.kind,
  status: entity.status,
  slug: entity.slug,
  source: entity.source,
  scopeProjectId: entity.scopeProject?.id ?? null,
  scopeInstanceId: entity.scopeInstance?.id ?? null,
  identifiers
});

export let loadLinks = async (d: {
  organizationOid: bigint;
  from: Date;
  to: Date;
}): Promise<{ links: GraphLink[]; entities: AttributionEntity[] }> => {
  let liveEntity = { status: { in: ['managed' as const, 'discovered' as const] } };

  let rows = await db.entityLink.findMany({
    where: {
      organizationOid: d.organizationOid,
      validFrom: { lte: d.to },
      OR: [{ validTo: null }, { validTo: { gt: d.from } }],
      from: liveEntity,
      to: liveEntity
    },
    include: {
      from: { select: attributionEntitySelect },
      to: { select: attributionEntitySelect }
    }
  });

  let entities = new Map<string, AttributionEntity>();
  for (let row of rows) {
    entities.set(row.from.id, toAttributionEntity(row.from));
    entities.set(row.to.id, toAttributionEntity(row.to));
  }

  return {
    entities: [...entities.values()],
    links: rows.map(row => ({
      id: row.id,
      type: row.type,
      fromId: row.from.id,
      fromKind: row.from.kind,
      toId: row.to.id,
      toKind: row.to.kind,
      weight: row.weight,
      validFrom: row.validFrom,
      validTo: row.validTo
    }))
  };
};

export let loadRuleDefinitions = async (organizationOid: bigint) => {
  let rows = await db.attributionRule.findMany({
    where: { organizationOid, enabled: true, archivedAt: null },
    include: {
      targetEntity: { select: attributionEntitySelect },
      scopeProject: { select: { id: true } },
      scopeInstance: { select: { id: true } }
    },
    orderBy: [{ priority: 'desc' }, { oid: 'asc' }]
  });

  return {
    rules: rows.map((row): AttributionRuleDefinition => ({
      id: row.id,
      effect: row.effect,
      priority: row.priority,
      targetId: row.targetEntity.id,
      scopeProjectId: row.scopeProject?.id ?? null,
      scopeInstanceId: row.scopeInstance?.id ?? null,
      validFrom: row.validFrom,
      match: row.match
    })),
    targets: rows.map(row => toAttributionEntity(row.targetEntity))
  };
};

let loadContext = async (organizationId: string): Promise<OrganizationAttributionContext> => {
  let organization = await db.organization.findUniqueOrThrow({
    where: { id: organizationId }
  });

  let now = new Date();
  let from = new Date(now.getTime() - cachedLinkWindowMs);

  let [kindRecords, ruleDefinitions, managed, links] = await Promise.all([
    db.entityKind.findMany({ where: { organizationOid: organization.oid } }),
    loadRuleDefinitions(organization.oid),
    db.entity.groupBy({
      by: ['kind'],
      where: { organizationOid: organization.oid, status: 'managed' }
    }),
    loadLinks({ organizationOid: organization.oid, from, to: now })
  ]);

  let kinds = new Map(
    mergeKindDefinitions(kindRecords).map(kind => [
      kind.key,
      { key: kind.key, cardinality: kind.cardinality, tagOrigins: kind.tagOrigins }
    ])
  );

  let entities = new Map<string, AttributionEntity>();
  for (let entity of [...links.entities, ...ruleDefinitions.targets]) {
    entities.set(entity.id, entity);
  }

  return {
    organization,
    kinds,
    rules: ruleDefinitions.rules,
    managedKinds: managed
      .map(group => group.kind)
      .filter(kind => isCustomerManagedKind(kind) && kinds.has(kind))
      .sort(),
    entities,
    recentLinks: { from, links: links.links }
  };
};

let contexts = new Map<
  string,
  { loadedAt: number; context: Promise<OrganizationAttributionContext> }
>();

// Per process with a short TTL: changes made through this process invalidate it right away,
// other processes pick them up within the TTL.
export let getAttributionContext = (organizationId: string) => {
  let cached = contexts.get(organizationId);
  if (cached && Date.now() - cached.loadedAt < contextTtlMs) return cached.context;

  let context = loadContext(organizationId);
  contexts.set(organizationId, { loadedAt: Date.now(), context });
  context.catch(() => contexts.delete(organizationId));

  return context;
};

export let invalidateAttributionContext = (organizationId: string) => {
  contexts.delete(organizationId);
};

export let toAttributionSession = (session: SessionDocument): AttributionSession => ({
  projectId: session.projectId,
  instanceId: session.instanceId,
  startedAt: session.startedAt,
  client: session.client ?? { family: 'unknown' },
  observed: {
    ...session.observed,
    clientUserIds: session.observed?.clientUserIds ?? [],
    clientInstallationIds: session.observed?.clientInstallationIds ?? []
  },
  context: {
    ...session.context,
    workspaceIds: session.context?.workspaceIds ?? [],
    repoIds: session.context?.repoIds ?? [],
    ticketRefs: session.context?.ticketRefs ?? [],
    tags: session.context?.tags ?? [],
    pathStored: session.context?.pathStored ?? false
  },
  manual: session.manual,
  classification: session.classification,
  models: (session.summary?.models ?? []).flatMap(model => [
    ...(model.modelId ? [model.modelId] : []),
    ...(model.rawIds ?? [])
  ]),
  mcpServers: session.summary?.mcpServers ?? []
});

let referencedIds = (session: AttributionSession) => [
  ...[session.observed.userId, session.observed.deviceId, session.observed.agentId].filter(
    (id): id is string => !!id
  ),
  ...session.observed.clientUserIds,
  ...session.observed.clientInstallationIds,
  ...session.context.repoIds,
  ...session.context.workspaceIds,
  ...(session.manual ?? []).flatMap(manual => (manual.entityId ? [manual.entityId] : [])),
  ...(session.classification?.results ?? []).flatMap(result =>
    result.accepted ? [result.accepted.entityId] : []
  )
];

export type LoadedAttributionInputs = {
  context: OrganizationAttributionContext;
  entities: Map<string, AttributionEntity>;
  slugs: Map<string, string>;
  emails: Map<string, string>;
};

export let loadAttributionInputs = async (d: {
  organizationId: string;
  sessions: AttributionSession[];
}): Promise<LoadedAttributionInputs> => {
  let context = await getAttributionContext(d.organizationId);
  let organizationOid = context.organization.oid;

  let ids = [...new Set(d.sessions.flatMap(referencedIds))];

  let slugPairs = new Map<string, { kind: string; slug: string }>();
  let emails = new Set<string>();

  for (let session of d.sessions) {
    for (let tag of session.context.tags) {
      if (tag.k.trim().toLowerCase() == initiatorTagKey) {
        emails.add(normalizeEmail(tag.v));
        continue;
      }

      let kind = tagKindKey(tag.k);
      if (kind && context.kinds.has(kind)) {
        slugPairs.set(slugKey(kind, tag.v), { kind, slug: tag.v.trim().toLowerCase() });
      }
    }
  }

  let [byId, bySlug, byEmail] = await Promise.all([
    ids.length
      ? db.entity.findMany({
          where: { organizationOid, id: { in: ids } },
          select: {
            ...attributionEntitySelect,
            identifiers: { select: { type: true, value: true } }
          }
        })
      : [],
    slugPairs.size
      ? db.entity.findMany({
          where: { organizationOid, OR: [...slugPairs.values()] },
          select: attributionEntitySelect
        })
      : [],
    emails.size
      ? db.entityIdentifier.findMany({
          where: { organizationOid, kind: 'user', type: 'email', value: { in: [...emails] } },
          select: { value: true, entity: { select: attributionEntitySelect } }
        })
      : []
  ]);

  let entities = new Map(context.entities);
  let slugs = new Map<string, string>();
  let emailIndex = new Map<string, string>();

  for (let entity of bySlug) {
    entities.set(entity.id, toAttributionEntity(entity));
    if (entity.slug) slugs.set(slugKey(entity.kind, entity.slug), entity.id);
  }

  for (let identifier of byEmail) {
    if (identifier.entity.status != 'managed' && identifier.entity.status != 'discovered') {
      continue;
    }

    entities.set(identifier.entity.id, toAttributionEntity(identifier.entity));
    emailIndex.set(identifier.value, identifier.entity.id);
  }

  for (let entity of byId) {
    entities.set(entity.id, toAttributionEntity(entity, entity.identifiers));
  }

  return { context, entities, slugs, emails: emailIndex };
};

export let linksForSession = async (
  context: OrganizationAttributionContext,
  session: Pick<AttributionSession, 'startedAt'>
) => {
  if (session.startedAt >= context.recentLinks.from) {
    return { links: context.recentLinks.links, entities: [] as AttributionEntity[] };
  }

  return await loadLinks({
    organizationOid: context.organization.oid,
    from: session.startedAt,
    to: session.startedAt
  });
};

export let buildResolveInput = async (d: {
  loaded: LoadedAttributionInputs;
  session: AttributionSession;
  rules?: AttributionRuleDefinition[];
  credentialAgent?: boolean;
  sessionless?: boolean;
}): Promise<ResolveAttributionInput> => {
  let { context } = d.loaded;

  let links = await linksForSession(context, d.session);

  let entities = d.loaded.entities;
  if (links.entities.length) {
    entities = new Map(entities);
    for (let entity of links.entities) entities.set(entity.id, entity);
  }

  return {
    session: d.session,
    kinds: context.kinds,
    entities,
    slugs: d.loaded.slugs,
    emails: d.loaded.emails,
    rules: d.rules ?? context.rules,
    links: links.links,
    managedKinds: context.managedKinds,
    credentialAgent: d.credentialAgent,
    sessionless: d.sessionless
  };
};
