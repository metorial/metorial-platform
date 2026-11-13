import type { Redis } from 'ioredis';
import type { Organization } from '../../prisma/generated/client';
import { db } from '../db';
import type { LinkType } from '../entities/linkRules';
import { normalizeIdentifiers, type IdentifierInput } from '../entities/normalize';
import { findOrCreateDiscovered, followMerged, touchLastSeen } from '../entities/resolve';
import { linkService } from '../services/link';
import type { EntityAttributes } from '../types';
import {
  createEntityCache,
  createLocalCache,
  entityCacheKey,
  type EntityCache,
  type EntityCacheKey
} from './cache';

let localTtlMs = 60 * 1000;
let linkLockTtlSeconds = 60 * 60;
let newUserCounterTtlSeconds = 2 * 24 * 60 * 60;
let resolveConcurrency = 8;

let liveStatuses = ['managed', 'discovered'];

export type EntityRequest = {
  key: string;
  kind: string;
  identifiers: IdentifierInput[];
  name?: string | null;
  attributes?: EntityAttributes;
  needsReview?: boolean;
  newUser?: { sourceId: string; limitPerDay: number };
};

export type LinkRequest = { fromId: string; toId: string; type: LinkType };

export type IdentityResolver = {
  resolveEntities: (d: {
    organizationId: string;
    requests: EntityRequest[];
    at: Date;
  }) => Promise<Map<string, string>>;
  ensureLinks: (d: { organizationId: string; links: LinkRequest[] }) => Promise<void>;
  userEmails: (d: {
    organizationId: string;
    userIds: string[];
  }) => Promise<Map<string, string[]>>;
  claimOnce: (key: string, ttlSeconds: number) => Promise<boolean>;
  touch: (entityIds: string[], at: Date) => Promise<void>;
};

export let newUserCounterKey = (sourceId: string, at: Date) =>
  `gs:newusers:${sourceId}:${at.toISOString().slice(0, 10)}`;

export let linkLockKey = (organizationId: string, link: LinkRequest) =>
  `gs:link:${organizationId}:${link.fromId}:${link.type}:${link.toId}`;

let inChunks = async <T>(items: T[], size: number, run: (item: T) => Promise<void>) => {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(run));
  }
};

export let createIdentityResolver = (d: {
  redis: Redis;
  cache?: EntityCache;
}): IdentityResolver => {
  let { redis } = d;
  let cache = d.cache ?? createEntityCache(redis);

  let organizations = createLocalCache<Organization>({ ttlMs: localTtlMs, capacity: 1_000 });
  let emails = createLocalCache<string[]>({ ttlMs: localTtlMs, capacity: 10_000 });
  let linked = createLocalCache<true>({ ttlMs: localTtlMs, capacity: 20_000 });
  let touched = createLocalCache<true>({ ttlMs: localTtlMs, capacity: 50_000 });

  let organizationOf = async (organizationId: string) => {
    let cached = organizations.get(organizationId);
    if (cached) return cached;

    let organization = await db.organization.findUnique({ where: { id: organizationId } });
    if (organization) organizations.set(organizationId, organization);

    return organization;
  };

  let isOverNewUserLimit = async (
    newUser: NonNullable<EntityRequest['newUser']>,
    at: Date
  ) => {
    let key = newUserCounterKey(newUser.sourceId, at);
    let count = await redis.incr(key);
    if (count == 1) await redis.expire(key, newUserCounterTtlSeconds);

    return { key, over: count > newUser.limitPerDay };
  };

  let resolveOne = async (
    organization: Organization,
    request: EntityRequest,
    at: Date
  ): Promise<string> => {
    let needsReview = request.needsReview ?? false;
    let counted: string | undefined;

    if (request.newUser) {
      let existing = await db.entityIdentifier.findFirst({
        where: {
          organizationOid: organization.oid,
          kind: request.kind,
          OR: request.identifiers.map(identifier => ({
            type: identifier.type,
            value: identifier.value
          }))
        },
        select: { oid: true }
      });

      if (!existing) {
        let limit = await isOverNewUserLimit(request.newUser, at);
        counted = limit.key;
        needsReview ||= limit.over;
      }
    }

    let { entity, created } = await findOrCreateDiscovered({
      organization,
      kind: request.kind,
      identifiers: request.identifiers,
      name: request.name,
      attributes: request.attributes,
      needsReview
    });

    if (counted && !created) await redis.decr(counted);

    return entity.id;
  };

  return {
    resolveEntities: async ({ organizationId, requests, at }) => {
      let resolved = new Map<string, string>();

      let unique = [
        ...new Map(
          requests
            .map(request => ({
              ...request,
              identifiers: normalizeIdentifiers(request.identifiers)
            }))
            .filter(request => request.identifiers.length)
            .map(request => [request.key, request])
        ).values()
      ];
      if (!unique.length) return resolved;

      let primaryOf = (request: EntityRequest): EntityCacheKey => ({
        organizationId,
        kind: request.kind,
        type: request.identifiers[0]!.type,
        value: request.identifiers[0]!.value
      });

      let hits = await cache.getMany(unique.map(primaryOf));
      let misses: EntityRequest[] = [];

      for (let request of unique) {
        let hit = hits.get(entityCacheKey(primaryOf(request)));

        if (hit) resolved.set(request.key, hit);
        else misses.push(request);
      }

      if (!misses.length) return resolved;

      let organization = await organizationOf(organizationId);
      if (!organization) return resolved;

      let fresh: { key: EntityCacheKey; entityId: string }[] = [];

      await inChunks(misses, resolveConcurrency, async request => {
        let entityId = await resolveOne(organization, request, at);
        resolved.set(request.key, entityId);

        for (let identifier of request.identifiers) {
          fresh.push({
            key: { organizationId, kind: request.kind, ...identifier },
            entityId
          });
        }
      });

      await cache.setMany(fresh);

      return resolved;
    },

    ensureLinks: async ({ organizationId, links }) => {
      let pending = [
        ...new Map(links.map(link => [linkLockKey(organizationId, link), link])).entries()
      ].filter(([key]) => !linked.get(key));
      if (!pending.length) return;

      let organization = await organizationOf(organizationId);
      if (!organization) return;

      for (let [key, link] of pending) {
        let acquired = await redis.set(key, '1', 'EX', linkLockTtlSeconds, 'NX');
        linked.set(key, true);
        if (acquired != 'OK') continue;

        try {
          let entities = await db.entity.findMany({
            where: { organizationOid: organization.oid, id: { in: [link.fromId, link.toId] } }
          });

          let liveOf = async (id: string) => {
            let entity = entities.find(candidate => candidate.id == id);
            let current = entity ? await followMerged(entity) : undefined;

            return current && liveStatuses.includes(current.status) ? current : undefined;
          };

          let from = await liveOf(link.fromId);
          let to = await liveOf(link.toId);
          if (!from || !to || from.oid == to.oid) continue;

          // Any earlier link, even one an admin ended, means the relationship was already
          // decided; observation never brings it back.
          let earlier = await db.entityLink.findFirst({
            where: { fromOid: from.oid, toOid: to.oid, type: link.type },
            select: { oid: true }
          });
          if (earlier) continue;

          await linkService.upsertLink({
            organization,
            from,
            to,
            input: { type: link.type, origin: 'observed', reach: 'from_now' }
          });
        } catch (error) {
          linked.delete(key);
          await redis.del(key);
          throw error;
        }
      }
    },

    userEmails: async ({ organizationId, userIds }) => {
      let result = new Map<string, string[]>();
      let missing: string[] = [];

      for (let userId of new Set(userIds)) {
        let cached = emails.get(`${organizationId}:${userId}`);
        if (cached) result.set(userId, cached);
        else missing.push(userId);
      }

      if (!missing.length) return result;

      let organization = await organizationOf(organizationId);
      if (!organization) return result;

      let identifiers = await db.entityIdentifier.findMany({
        where: {
          organizationOid: organization.oid,
          kind: 'user',
          type: 'email',
          entity: { id: { in: missing } }
        },
        select: { value: true, entity: { select: { id: true } } }
      });

      for (let userId of missing) {
        let values = identifiers
          .filter(identifier => identifier.entity.id == userId)
          .map(identifier => identifier.value);

        emails.set(`${organizationId}:${userId}`, values);
        result.set(userId, values);
      }

      return result;
    },

    claimOnce: async (key, ttlSeconds) =>
      (await redis.set(key, '1', 'EX', ttlSeconds, 'NX')) == 'OK',

    touch: async (entityIds, at) => {
      let due = [...new Set(entityIds)].filter(id => !touched.get(id));
      if (!due.length) return;

      await touchLastSeen(due, at);
      for (let id of due) touched.set(id, true);
    }
  };
};
