import {
  badRequestError,
  conflictError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Entity, EntityStatus, Organization, Prisma } from '@mtsrc/agent-tracking-db';
import { db, withTransaction } from '@mtsrc/agent-tracking-db';
import {
  emailsOf,
  normalizeIdentifiers,
  normalizeSlug,
  type IdentifierInput
} from '../lib/normalize';
import { applyPendingMemberships } from '../lib/pending';
import { followMerged, isUniqueViolation } from '../lib/resolve';
import { getId } from '@mtsrc/agent-tracking-db';
import type { EntityAttributes } from '@mtsrc/agent-tracking-spec';
import { entityKindService } from './entityKind';
import { Events } from '@mtsrc/agent-tracking-events';

let maxUpsertAttempts = 3;

let liveStatuses: EntityStatus[] = ['managed', 'discovered'];

export let entityInclude = {
  identifiers: { orderBy: { oid: 'asc' } },
  scopeProject: true,
  scopeInstance: true
} satisfies Prisma.EntityInclude;

export type EntityWithRelations = Prisma.EntityGetPayload<{
  include: typeof entityInclude;
}> & {
  mergedInto: { id: string } | null;
};

export type EntityScopeInput = { projectId?: string; instanceId?: string } | null;

type MergeResult = {
  winnerId: string;
  loserId: string;
  tokenPrefixes: string[];
  movedIdentifiers: { kind: string; type: string; value: string }[];
};

class EntityServiceImpl {
  async upsertEntity(d: {
    organization: Organization;
    input: {
      kind: string;
      source?: string;
      ref?: string;
      slug?: string | null;
      name?: string | null;
      attributes?: EntityAttributes;
      scope?: EntityScopeInput;
      identifiers?: IdentifierInput[];
    };
  }) {
    await entityKindService.assertKindExists({
      organization: d.organization,
      key: d.input.kind
    });

    let identifiers = normalizeIdentifiers(d.input.identifiers ?? []);
    let slug = d.input.slug ? normalizeSlug(d.input.slug) : d.input.slug;
    let source = d.input.ref ? (d.input.source ?? 'customer') : undefined;
    let scope = await this.resolveScope({
      organization: d.organization,
      scope: d.input.scope
    });

    for (let attempt = 1; ; attempt++) {
      let merges: MergeResult[] = [];

      try {
        let entity = await withTransaction(async db => {
          let existing = await this.findUpsertTarget({
            organization: d.organization,
            kind: d.input.kind,
            source,
            ref: d.input.ref,
            slug,
            identifiers
          });

          if (slug) {
            await this.assertSlugAvailable({
              organization: d.organization,
              kind: d.input.kind,
              slug,
              existing
            });
          }

          let data = {
            name: d.input.name,
            slug,
            ...scope,
            status: 'managed' as const,
            needsReview: false,
            archivedAt: null
          };

          let entity = existing
            ? await db.entity.update({
                where: { oid: existing.oid },
                data: {
                  ...data,
                  attributes: d.input.attributes
                    ? { ...existing.attributes, ...d.input.attributes }
                    : undefined,
                  ...(existing.status == 'discovered' && d.input.ref
                    ? { source, ref: d.input.ref }
                    : {})
                }
              })
            : await db.entity.create({
                data: {
                  ...getId('entity'),
                  ...data,
                  kind: d.input.kind,
                  source,
                  ref: d.input.ref,
                  attributes: d.input.attributes ?? {},
                  organizationOid: d.organization.oid
                }
              });

          merges = await this.claimIdentifiers({
            organization: d.organization,
            entity,
            identifiers
          });

          return entity;
        });

        await this.afterIdentifierChange({
          organization: d.organization,
          entity,
          identifiers,
          merges
        });

        return await this.getEntityByOid(entity.oid);
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= maxUpsertAttempts) throw error;
      }
    }
  }

  async getEntityById(d: { organization: Organization; entityId: string }) {
    let entity = await db.entity.findFirst({
      where: { id: d.entityId, organizationOid: d.organization.oid },
      include: entityInclude
    });
    if (!entity) throw new ServiceError(notFoundError('entity', d.entityId));

    return (await this.withMergedInto([entity]))[0]!;
  }

  async getEntityByRef(d: {
    organization: Organization;
    kind: string;
    source: string;
    ref: string;
  }) {
    let entity = await db.entity.findUnique({
      where: {
        organizationOid_kind_source_ref: {
          organizationOid: d.organization.oid,
          kind: d.kind,
          source: d.source,
          ref: d.ref
        }
      },
      include: entityInclude
    });
    if (!entity) throw new ServiceError(notFoundError('entity', d.ref));

    return (await this.withMergedInto([entity]))[0]!;
  }

  async getEntitiesByIds(d: { organization: Organization; entityIds: string[] }) {
    let ids = [...new Set(d.entityIds)];

    let entities = await db.entity.findMany({
      where: { id: { in: ids }, organizationOid: d.organization.oid },
      include: entityInclude
    });

    let missing = ids.find(id => !entities.some(entity => entity.id == id));
    if (missing) throw new ServiceError(notFoundError('entity', missing));

    return await this.withMergedInto(entities);
  }

  async listEntities(d: {
    organization: Organization;
    kinds?: string[];
    statuses?: EntityStatus[];
    scope?: { projectId?: string; instanceId?: string };
    search?: string;
    needsReview?: boolean;
  }) {
    let scope = d.scope
      ? await this.resolveScope({ organization: d.organization, scope: d.scope })
      : undefined;
    let search = d.search?.trim();

    let where: Prisma.EntityWhereInput = {
      organizationOid: d.organization.oid,
      kind: d.kinds ? { in: d.kinds } : undefined,
      status: { in: d.statuses ?? liveStatuses },
      needsReview: d.needsReview,
      AND: [
        ...(scope?.scopeProjectOid
          ? [{ OR: [{ scopeProjectOid: null }, { scopeProjectOid: scope.scopeProjectOid }] }]
          : []),
        ...(scope?.scopeInstanceOid
          ? [
              {
                OR: [{ scopeInstanceOid: null }, { scopeInstanceOid: scope.scopeInstanceOid }]
              }
            ]
          : []),
        ...(search
          ? [
              {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { slug: { contains: search.toLowerCase() } },
                  {
                    identifiers: {
                      some: { value: { contains: search, mode: 'insensitive' as const } }
                    }
                  }
                ]
              }
            ]
          : [])
      ]
    };

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let entities = await db.entity.findMany({ ...opts, where, include: entityInclude });

        return await this.withMergedInto(entities);
      })
    );
  }

  async archiveEntity(d: { organization: Organization; entity: Entity }) {
    if (d.entity.status == 'archived') return await this.getEntityByOid(d.entity.oid);
    if (d.entity.status == 'merged') {
      throw new ServiceError(
        preconditionFailedError({ message: 'A merged entity cannot be archived.' })
      );
    }

    let now = new Date();

    let released = await withTransaction(async db => {
      let released = await db.entityIdentifier.findMany({
        where: { entityOid: d.entity.oid },
        select: { kind: true, type: true, value: true }
      });

      await db.entityIdentifier.deleteMany({ where: { entityOid: d.entity.oid } });

      await db.entityLink.updateMany({
        where: {
          OR: [{ fromOid: d.entity.oid }, { toOid: d.entity.oid }],
          validTo: null
        },
        data: { validTo: now }
      });

      await db.mergeSuggestion.updateMany({
        where: {
          status: 'open',
          OR: [{ discoveredEntityOid: d.entity.oid }, { managedEntityOid: d.entity.oid }]
        },
        data: { status: 'dismissed' }
      });

      await db.entity.update({
        where: { oid: d.entity.oid },
        data: { status: 'archived', archivedAt: now, slug: null }
      });

      return released;
    });

    await Events.fire('entities.identifiers.released:after', {
      organizationId: d.organization.id,
      identifiers: released
    });

    return await this.getEntityByOid(d.entity.oid);
  }

  async setIdentifiers(d: {
    organization: Organization;
    entity: Entity;
    types?: string[];
    identifiers: IdentifierInput[];
  }) {
    this.assertEntityLive(d.entity);

    let identifiers = normalizeIdentifiers(d.identifiers);
    let types = [
      ...new Set(
        (d.types ?? identifiers.map(identifier => identifier.type)).map(type =>
          type.trim().toLowerCase()
        )
      )
    ];

    if (!types.length) {
      throw new ServiceError(
        badRequestError({
          message: 'Pass the identifier types to replace or at least one identifier.'
        })
      );
    }

    if (identifiers.some(identifier => !types.includes(identifier.type))) {
      throw new ServiceError(
        badRequestError({ message: 'Every identifier must have one of the replaced types.' })
      );
    }

    let merges: MergeResult[] = [];
    let released: IdentifierInput[] = [];

    await withTransaction(async db => {
      let current = await db.entityIdentifier.findMany({
        where: { entityOid: d.entity.oid, type: { in: types } }
      });

      let removed = current.filter(
        existing =>
          !identifiers.some(
            identifier =>
              identifier.type == existing.type && identifier.value == existing.value
          )
      );

      await db.entityIdentifier.deleteMany({
        where: { oid: { in: removed.map(identifier => identifier.oid) } }
      });
      released = removed;

      merges = await this.claimIdentifiers({
        organization: d.organization,
        entity: d.entity,
        identifiers
      });
    });

    await this.afterIdentifierChange({
      organization: d.organization,
      entity: d.entity,
      identifiers,
      released,
      merges
    });

    return await this.getEntityByOid(d.entity.oid);
  }

  async mergeEntities(d: { organization: Organization; winner: Entity; loser: Entity }) {
    if (d.winner.oid == d.loser.oid) {
      throw new ServiceError(
        badRequestError({ message: 'An entity cannot be merged into itself.' })
      );
    }

    if (d.winner.kind != d.loser.kind) {
      throw new ServiceError(
        badRequestError({ message: 'Only entities of the same kind can be merged.' })
      );
    }

    this.assertEntityLive(d.winner);
    this.assertEntityLive(d.loser);

    if (d.loser.status == 'managed' && d.winner.status != 'managed') {
      throw new ServiceError(
        badRequestError({
          message:
            'A managed entity cannot be merged into a discovered one; merge the other way.'
        })
      );
    }

    if (d.loser.status == 'managed' && d.loser.kind == 'user') {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'Two managed users cannot be merged in agent tracking; merge them in Metorial.'
        })
      );
    }

    let merge = await withTransaction(
      async () =>
        await this.mergeWithinTransaction({
          organization: d.organization,
          winner: d.winner,
          loser: d.loser
        })
    );

    await this.afterMerges({ organization: d.organization, merges: [merge] });

    return await this.getEntityByOid(d.winner.oid);
  }

  private async getEntityByOid(oid: bigint) {
    let entity = await db.entity.findUniqueOrThrow({ where: { oid }, include: entityInclude });

    return (await this.withMergedInto([entity]))[0]!;
  }

  private async withMergedInto<T extends Entity>(entities: T[]) {
    let winnerOids = [
      ...new Set(entities.map(entity => entity.mergedIntoOid).filter(oid => oid != null))
    ];

    let winners = winnerOids.length
      ? await db.entity.findMany({
          where: { oid: { in: winnerOids } },
          select: { oid: true, id: true }
        })
      : [];

    return entities.map(entity => {
      let winner = winners.find(candidate => candidate.oid == entity.mergedIntoOid);

      return { ...entity, mergedInto: winner ? { id: winner.id } : null };
    });
  }

  private async resolveScope(d: {
    organization: Organization;
    scope: EntityScopeInput | undefined;
  }) {
    if (d.scope === undefined) return {};
    if (d.scope === null) return { scopeProjectOid: null, scopeInstanceOid: null };

    let project = d.scope.projectId
      ? await db.project.findFirst({
          where: {
            OR: [{ id: d.scope.projectId }, { ref: d.scope.projectId }],
            organizationOid: d.organization.oid
          }
        })
      : null;
    if (d.scope.projectId && !project) {
      throw new ServiceError(notFoundError('project', d.scope.projectId));
    }

    let instance = d.scope.instanceId
      ? await db.instance.findFirst({
          where: {
            OR: [{ id: d.scope.instanceId }, { ref: d.scope.instanceId }],
            organizationOid: d.organization.oid
          }
        })
      : null;
    if (d.scope.instanceId && !instance) {
      throw new ServiceError(notFoundError('instance', d.scope.instanceId));
    }

    if (project && instance && instance.projectOid != project.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'The scope instance does not belong to the scope project.'
        })
      );
    }

    return {
      scopeProjectOid: project?.oid ?? instance?.projectOid ?? null,
      scopeInstanceOid: instance?.oid ?? null
    };
  }

  private async findUpsertTarget(d: {
    organization: Organization;
    kind: string;
    source?: string;
    ref?: string;
    slug?: string | null;
    identifiers: IdentifierInput[];
  }) {
    return await withTransaction(
      async db => {
        let byKey =
          d.ref && d.source
            ? await db.entity.findUnique({
                where: {
                  organizationOid_kind_source_ref: {
                    organizationOid: d.organization.oid,
                    kind: d.kind,
                    source: d.source,
                    ref: d.ref
                  }
                }
              })
            : !d.ref && d.slug
              ? await db.entity.findUnique({
                  where: {
                    organizationOid_kind_slug: {
                      organizationOid: d.organization.oid,
                      kind: d.kind,
                      slug: d.slug
                    }
                  }
                })
              : null;
        if (byKey) return await followMerged(byKey);

        if (!d.identifiers.length) return null;

        let owners = await db.entityIdentifier.findMany({
          where: {
            organizationOid: d.organization.oid,
            kind: d.kind,
            OR: d.identifiers.map(identifier => ({
              type: identifier.type,
              value: identifier.value
            }))
          },
          include: { entity: true }
        });

        let candidates: Entity[] = [];
        for (let owner of owners) candidates.push(await followMerged(owner.entity));

        return (
          candidates
            .filter(candidate => candidate.status == 'discovered')
            .sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || Number(a.oid - b.oid)
            )[0] ?? null
        );
      },
      { ifExists: true }
    );
  }

  private async assertSlugAvailable(d: {
    organization: Organization;
    kind: string;
    slug: string;
    existing: Entity | null;
  }) {
    let holder = await withTransaction(
      async db =>
        await db.entity.findUnique({
          where: {
            organizationOid_kind_slug: {
              organizationOid: d.organization.oid,
              kind: d.kind,
              slug: d.slug
            }
          }
        }),
      { ifExists: true }
    );

    if (holder && holder.oid != d.existing?.oid) {
      throw new ServiceError(
        conflictError({
          message: `The slug "${d.slug}" is already used by another ${d.kind}.`
        })
      );
    }
  }

  private async claimIdentifiers(d: {
    organization: Organization;
    entity: Entity;
    identifiers: IdentifierInput[];
  }) {
    let merges: MergeResult[] = [];

    await withTransaction(async db => {
      for (let identifier of d.identifiers) {
        let owner = await db.entityIdentifier.findUnique({
          where: {
            organizationOid_kind_type_value: {
              organizationOid: d.organization.oid,
              kind: d.entity.kind,
              type: identifier.type,
              value: identifier.value
            }
          },
          include: { entity: true }
        });

        if (!owner) {
          await db.entityIdentifier.create({
            data: {
              ...getId('entityIdentifier'),
              kind: d.entity.kind,
              type: identifier.type,
              value: identifier.value,
              organizationOid: d.organization.oid,
              entityOid: d.entity.oid
            }
          });
          continue;
        }

        if (owner.entityOid == d.entity.oid) continue;

        if (owner.entity.status == 'discovered' && d.entity.status == 'managed') {
          merges.push(
            await this.mergeWithinTransaction({
              organization: d.organization,
              winner: d.entity,
              loser: owner.entity
            })
          );
          continue;
        }

        if (d.entity.status != 'managed') {
          throw new ServiceError(
            conflictError({
              message: `The identifier ${identifier.type}:${identifier.value} belongs to another entity.`
            })
          );
        }

        await db.entityIdentifier.update({
          where: { oid: owner.oid },
          data: { entityOid: d.entity.oid }
        });
      }
    });

    return merges;
  }

  private async mergeWithinTransaction(d: {
    organization: Organization;
    winner: Entity;
    loser: Entity;
  }): Promise<MergeResult> {
    return await withTransaction(async db => {
      let winner = await db.entity.findUniqueOrThrow({ where: { oid: d.winner.oid } });
      let loser = await db.entity.findUniqueOrThrow({ where: { oid: d.loser.oid } });

      let movedIdentifiers = await db.entityIdentifier.findMany({
        where: { entityOid: loser.oid },
        select: { kind: true, type: true, value: true }
      });

      await db.entityIdentifier.updateMany({
        where: { entityOid: loser.oid },
        data: { entityOid: winner.oid }
      });

      await this.moveLinks({ winner, loser });

      let tokens = await db.ingestToken.findMany({
        where: {
          OR: [
            { userEntityOid: loser.oid },
            { deviceEntityOid: loser.oid },
            { agentEntityOid: loser.oid }
          ]
        },
        select: { prefix: true }
      });

      await db.ingestToken.updateMany({
        where: { userEntityOid: loser.oid },
        data: { userEntityOid: winner.oid }
      });
      await db.ingestToken.updateMany({
        where: { deviceEntityOid: loser.oid },
        data: { deviceEntityOid: winner.oid }
      });
      await db.ingestToken.updateMany({
        where: { agentEntityOid: loser.oid },
        data: { agentEntityOid: winner.oid }
      });

      let pending = await db.pendingMembership.findMany({
        where: { targetEntityOid: { in: [loser.oid, winner.oid] } }
      });
      let winnerPending = new Set(
        pending
          .filter(membership => membership.targetEntityOid == winner.oid)
          .map(membership => `${membership.email}\u0000${membership.type}`)
      );
      let duplicatePending = pending.filter(
        membership =>
          membership.targetEntityOid == loser.oid &&
          winnerPending.has(`${membership.email}\u0000${membership.type}`)
      );

      await db.pendingMembership.deleteMany({
        where: { oid: { in: duplicatePending.map(membership => membership.oid) } }
      });
      await db.pendingMembership.updateMany({
        where: { targetEntityOid: loser.oid },
        data: { targetEntityOid: winner.oid }
      });

      await db.attributionRule.updateMany({
        where: { targetEntityOid: loser.oid },
        data: { targetEntityOid: winner.oid }
      });
      await db.classifierLabel.updateMany({
        where: { entityOid: loser.oid },
        data: { entityOid: winner.oid }
      });

      await db.mergeSuggestion.updateMany({
        where: {
          status: 'open',
          OR: [
            { discoveredEntityOid: loser.oid, managedEntityOid: winner.oid },
            { discoveredEntityOid: winner.oid, managedEntityOid: loser.oid }
          ]
        },
        data: { status: 'accepted' }
      });
      await db.mergeSuggestion.updateMany({
        where: {
          status: 'open',
          OR: [{ discoveredEntityOid: loser.oid }, { managedEntityOid: loser.oid }]
        },
        data: { status: 'dismissed' }
      });

      await db.entity.updateMany({
        where: { mergedIntoOid: loser.oid },
        data: { mergedIntoOid: winner.oid }
      });

      await db.entity.update({
        where: { oid: loser.oid },
        data: { status: 'merged', mergedIntoOid: winner.oid, slug: null }
      });

      await db.entity.update({
        where: { oid: winner.oid },
        data: {
          firstSeenAt: earliest(winner.firstSeenAt, loser.firstSeenAt),
          lastSeenAt: latest(winner.lastSeenAt, loser.lastSeenAt)
        }
      });

      return {
        winnerId: winner.id,
        loserId: loser.id,
        tokenPrefixes: tokens.map(token => token.prefix),
        movedIdentifiers
      };
    });
  }

  private async moveLinks(d: { winner: Entity; loser: Entity }) {
    await withTransaction(async db => {
      let loserLinks = await db.entityLink.findMany({
        where: { OR: [{ fromOid: d.loser.oid }, { toOid: d.loser.oid }] }
      });
      let winnerLinks = await db.entityLink.findMany({
        where: { OR: [{ fromOid: d.winner.oid }, { toOid: d.winner.oid }] }
      });

      for (let link of loserLinks) {
        let fromOid = link.fromOid == d.loser.oid ? d.winner.oid : link.fromOid;
        let toOid = link.toOid == d.loser.oid ? d.winner.oid : link.toOid;

        let covered = winnerLinks.some(
          existing =>
            existing.type == link.type &&
            existing.fromOid == fromOid &&
            existing.toOid == toOid &&
            existing.validFrom <= link.validFrom &&
            (existing.validTo == null ||
              (link.validTo != null && existing.validTo >= link.validTo))
        );

        if (fromOid == toOid || covered) {
          await db.entityLink.delete({ where: { oid: link.oid } });
          continue;
        }

        let moved = await db.entityLink.update({
          where: { oid: link.oid },
          data: { fromOid, toOid }
        });
        winnerLinks.push(moved);
      }
    });
  }

  private async afterIdentifierChange(d: {
    organization: Organization;
    entity: Entity;
    identifiers: IdentifierInput[];
    released?: IdentifierInput[];
    merges: MergeResult[];
  }) {
    // Claimed identifiers may have been taken from another entity, so they are dropped too.
    await Events.fire('entities.identifiers.released:after', {
      organizationId: d.organization.id,
      identifiers: [...(d.released ?? []), ...d.identifiers].map(identifier => ({
        kind: d.entity.kind,
        type: identifier.type,
        value: identifier.value
      }))
    });

    await this.afterMerges({ organization: d.organization, merges: d.merges });

    await applyPendingMemberships({
      organizationOid: d.organization.oid,
      userEntity: d.entity,
      emails: emailsOf(d.identifiers)
    });
  }

  private async afterMerges(d: { organization: Organization; merges: MergeResult[] }) {
    for (let merge of d.merges) {
      await Events.fire('entities.identifiers.released:after', {
        organizationId: d.organization.id,
        identifiers: merge.movedIdentifiers
      });

      await Events.fire('entities.entity.merged:after', {
        organizationId: d.organization.id,
        winnerId: merge.winnerId,
        loserId: merge.loserId,
        tokenPrefixes: merge.tokenPrefixes
      });
    }
  }

  private assertEntityLive(entity: Entity) {
    if (!liveStatuses.includes(entity.status)) {
      throw new ServiceError(
        preconditionFailedError({ message: `The entity ${entity.id} is ${entity.status}.` })
      );
    }
  }
}

let earliest = (a: Date | null, b: Date | null) => (a && b ? (a < b ? a : b) : (a ?? b));

let latest = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

export let entityService = Service.create(
  'entityService',
  () => new EntityServiceImpl()
).build();
