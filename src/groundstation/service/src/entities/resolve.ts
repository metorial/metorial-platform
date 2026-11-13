import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { Entity, Organization } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import type { EntityAttributes } from '../types';
import {
  emailsOf,
  normalizeIdentifier,
  normalizeIdentifiers,
  type IdentifierInput
} from './normalize';
import { applyPendingMemberships } from './pending';

let maxCreateAttempts = 4;
let maxMergeHops = 3;
let lastSeenResolutionMs = 5 * 60 * 1000;

export let isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code == 'P2002';

export let followMerged = async (entity: Entity) => {
  let current = entity;

  for (
    let hop = 0;
    hop < maxMergeHops && current.status == 'merged' && current.mergedIntoOid;
    hop++
  ) {
    let next = await withTransaction(
      async db => await db.entity.findUnique({ where: { oid: current.mergedIntoOid! } }),
      { ifExists: true }
    );
    if (!next) break;

    current = next;
  }

  return current;
};

export let findEntityByIdentifier = async (d: {
  organizationOid: bigint;
  kind: string;
  type: string;
  value: string;
}) => {
  let identifier = normalizeIdentifier({ type: d.type, value: d.value });

  let found = await withTransaction(
    async db =>
      await db.entityIdentifier.findUnique({
        where: {
          organizationOid_kind_type_value: {
            organizationOid: d.organizationOid,
            kind: d.kind,
            type: identifier.type,
            value: identifier.value
          }
        },
        include: { entity: true }
      }),
    { ifExists: true }
  );
  if (!found) return null;

  return await followMerged(found.entity);
};

let attachMissingIdentifiers = async (d: {
  organizationOid: bigint;
  entity: Entity;
  kind: string;
  identifiers: IdentifierInput[];
}) => {
  if (!d.identifiers.length) return;

  // skipDuplicates: an identifier another entity already owns is never moved by a claim.
  await db.entityIdentifier.createMany({
    data: d.identifiers.map(identifier => ({
      ...getId('entityIdentifier'),
      kind: d.kind,
      type: identifier.type,
      value: identifier.value,
      organizationOid: d.organizationOid,
      entityOid: d.entity.oid
    })),
    skipDuplicates: true
  });

  await applyPendingMemberships({
    organizationOid: d.organizationOid,
    userEntity: d.entity,
    emails: emailsOf(d.identifiers)
  });
};

export let findOrCreateDiscovered = async (d: {
  organization: Pick<Organization, 'oid'>;
  kind: string;
  identifiers: IdentifierInput[];
  name?: string | null;
  attributes?: EntityAttributes;
  needsReview?: boolean;
}): Promise<{ entity: Entity; created: boolean }> => {
  let identifiers = normalizeIdentifiers(d.identifiers);
  if (!identifiers.length) {
    throw new ServiceError(
      badRequestError({ message: 'A discovered entity needs at least one identifier.' })
    );
  }

  for (let attempt = 1; ; attempt++) {
    let matches = await db.entityIdentifier.findMany({
      where: {
        organizationOid: d.organization.oid,
        kind: d.kind,
        OR: identifiers.map(identifier => ({ type: identifier.type, value: identifier.value }))
      },
      include: { entity: true }
    });

    let isMatched = (identifier: IdentifierInput) =>
      matches.some(match => match.type == identifier.type && match.value == identifier.value);

    let first = identifiers
      .map(identifier =>
        matches.find(match => match.type == identifier.type && match.value == identifier.value)
      )
      .find(Boolean);

    if (first) {
      let entity = await followMerged(first.entity);

      await attachMissingIdentifiers({
        organizationOid: d.organization.oid,
        entity,
        kind: d.kind,
        identifiers: identifiers.filter(identifier => !isMatched(identifier))
      });

      return { entity, created: false };
    }

    try {
      let now = new Date();

      let entity = await withTransaction(async db => {
        let entity = await db.entity.create({
          data: {
            ...getId('entity'),
            kind: d.kind,
            status: 'discovered',
            name: d.name ?? null,
            attributes: d.attributes ?? {},
            needsReview: d.needsReview ?? false,
            firstSeenAt: now,
            lastSeenAt: now,
            organizationOid: d.organization.oid
          }
        });

        await db.entityIdentifier.createMany({
          data: identifiers.map(identifier => ({
            ...getId('entityIdentifier'),
            kind: d.kind,
            type: identifier.type,
            value: identifier.value,
            organizationOid: d.organization.oid,
            entityOid: entity.oid
          }))
        });

        return entity;
      });

      await applyPendingMemberships({
        organizationOid: d.organization.oid,
        userEntity: entity,
        emails: emailsOf(identifiers)
      });

      return { entity, created: true };
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= maxCreateAttempts) throw error;
    }
  }
};

export let touchLastSeen = async (entityIds: string[], at: Date = new Date()) => {
  let ids = [...new Set(entityIds)];
  if (!ids.length) return;

  let staleBefore = new Date(at.getTime() - lastSeenResolutionMs);

  await db.$executeRaw`
    UPDATE "Entity"
    SET "lastSeenAt" = ${at}, "firstSeenAt" = COALESCE("firstSeenAt", ${at})
    WHERE "id" = ANY(${ids}) AND ("lastSeenAt" IS NULL OR "lastSeenAt" < ${staleBefore})
  `;
};
