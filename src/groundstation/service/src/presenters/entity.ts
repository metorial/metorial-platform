import type { Entity } from '../../prisma/generated/client';
import type { EntityWithRelations } from '../services/entity';

export let entityReferencePresenter = (entity: Entity) => ({
  object: 'groundstation#entity_reference',

  id: entity.id,
  kind: entity.kind,
  status: entity.status,
  name: entity.name,
  slug: entity.slug
});

export let entityPresenter = (entity: EntityWithRelations) => ({
  object: 'groundstation#entity',

  id: entity.id,
  kind: entity.kind,
  status: entity.status,

  source: entity.source,
  ref: entity.ref,
  slug: entity.slug,
  name: entity.name,
  attributes: entity.attributes,

  needsReview: entity.needsReview,
  mergedIntoId: entity.mergedInto?.id ?? null,

  scope: {
    projectId: entity.scopeProject?.id ?? null,
    instanceId: entity.scopeInstance?.id ?? null
  },

  identifiers: entity.identifiers.map(identifier => ({
    type: identifier.type,
    value: identifier.value,
    createdAt: identifier.createdAt
  })),

  firstSeenAt: entity.firstSeenAt,
  lastSeenAt: entity.lastSeenAt,
  archivedAt: entity.archivedAt,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt
});
