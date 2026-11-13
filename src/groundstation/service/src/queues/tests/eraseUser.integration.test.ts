import mongoose from 'mongoose';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../../prisma/generated/client';
import { collections, daysAgo, setupScope, store } from '../../attribution/tests/fixtures';
import { getId } from '../../id';
import { createEntityCache, entityCacheKey } from '../../identity/cache';
import { closeIdentityRedis, getIdentityRedis } from '../../identity/redis';
import { entityService, ingestTokenService, userErasureService } from '../../services';
import { closeSessionRedis } from '../../sessions/redis';
import type { UsageSliceDocument } from '../../store/derivedModels';
import type { RecordDocument } from '../../store/models';
import { cleanDatabase, testDb } from '../../test/setup';
import { eraseUserQueue, eraseUserStep, type UserErasureJob } from '../eraseUser';

type Scope = Awaited<ReturnType<typeof setupScope>>;

let queuedErasures = () => {
  let jobs: UserErasureJob[] = [];

  vi.spyOn(eraseUserQueue, 'add').mockImplementation((async (job: UserErasureJob) => {
    jobs.push(job);
  }) as never);

  let drain = async () => {
    let steps = 0;

    for (let job = jobs.shift(); job; steps++) {
      job = (await eraseUserStep(job))?.job;
    }

    return steps;
  };

  return { jobs, drain };
};

let link = (scope: Scope, from: Entity, to: Entity) =>
  testDb.entityLink.create({
    data: {
      ...getId('entityLink'),
      type: 'owned_by',
      origin: 'observed',
      validFrom: new Date(),
      organizationOid: scope.organization.oid,
      fromOid: from.oid,
      toOid: to.oid
    }
  });

let record = (scope: Scope, userId: string, hasText = false): RecordDocument => ({
  _id: crypto.randomUUID(),
  organizationId: scope.organization.id,
  projectId: scope.project.id,
  instanceId: scope.instance.id,
  spec: 'test',
  type: 'prompt.submitted',
  occurredAt: new Date(),
  observedAt: new Date(),
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  ingest: {
    credentialKind: 'token',
    credentialId: 'git_unit',
    route: 'hook',
    requestId: 'req',
    backfill: false
  },
  source: { adapter: 'test', dialect: 'test.v1', channel: 'hook', role: 'primary' },
  client: { family: 'claude-code' },
  attribution: { userId },
  ctx: {},
  data: {},
  ...(hasText
    ? { content: [{ role: 'prompt', mode: 'full', state: 'present', hasText: true }] }
    : {}),
  quality: { timeSource: 'client' }
});

let usageSlice = (scope: Scope, userId: string, teamId: string): UsageSliceDocument => ({
  _id: crypto.randomUUID(),
  organizationId: scope.organization.id,
  projectId: scope.project.id,
  instanceId: scope.instance.id,
  bucket: daysAgo(1),
  bucketMinutes: 15,
  sessionKey: crypto.randomUUID(),
  userId,
  workspaceIds: [],
  repoIds: [],
  dims: [
    { kind: 'user', id: userId, w: 1 },
    { kind: 'team', id: teamId, w: 1 }
  ],
  dimIds: [userId, teamId, scope.project.id, scope.instance.id],
  client: { family: 'claude-code' },
  sessionsStarted: 1,
  turns: 1,
  requests: 1,
  failedRequests: 0,
  toolCalls: 0,
  tokens: { inputUncached: 1, cacheRead: 0, cacheWrite: 0, output: 1, reasoning: 0 },
  costReported: [],
  costUsd: mongoose.Types.Decimal128.fromString('1'),
  lines: { added: 0, removed: 0 },
  attributionVersion: 1,
  factsVersion: 1,
  computedAt: new Date(),
  expiresAt: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000)
});

let entity = (id: string) => testDb.entity.findUnique({ where: { id } });

describe('user erasure', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeIdentityRedis();
    await closeSessionRedis();
    await store.close();
  });

  it('erases a token user with its devices, client users, records and sessions', async () => {
    let queues = queuedErasures();
    let scope = await setupScope();

    let { ingestToken } = await ingestTokenService.createIngestToken({
      organization: scope.organization,
      instance: scope.instance,
      input: { name: 'ci', userRef: 'con_ada', deviceMode: 'ephemeral' }
    });
    let ada = await scope.user('con_ada', 'ada@acme.com');
    expect(ada.oid).toBe(ingestToken.userEntityOid);

    let bob = await scope.user('con_bob', 'bob@acme.com');
    let team = await scope.entity({ kind: 'team', ref: 'payments' });

    let device = await scope.entity({
      kind: 'device',
      ref: 'ephemeral-1',
      attributes: { ephemeral: true, ip: '10.0.0.1', tokenId: ingestToken.id },
      identifiers: [{ type: 'ip', value: `${ingestToken.id}:10.0.0.1` }]
    });
    let adaClient = await scope.entity({
      kind: 'client_user',
      ref: 'ada-cc',
      identifiers: [{ type: 'account:claude-code', value: 'ada-account' }]
    });
    let sharedClient = await scope.entity({ kind: 'client_user', ref: 'shared-cc' });
    await link(scope, adaClient, ada);
    await link(scope, sharedClient, ada);
    await link(scope, sharedClient, bob);

    await testDb.pendingMembership.create({
      data: {
        ...getId('pendingMembership'),
        email: 'ada@acme.com',
        type: 'member_of',
        validFrom: new Date(),
        organizationOid: scope.organization.oid,
        targetEntityOid: team.oid
      }
    });

    let cache = createEntityCache(getIdentityRedis());
    let emailKey = {
      organizationId: scope.organization.id,
      kind: 'user',
      type: 'email',
      value: 'ada@acme.com'
    };
    await cache.setMany([{ key: emailKey, entityId: ada.id }]);

    let { events, measurements, contentTexts, sessions, usageSlices } = await collections();

    let adaEvent = record(scope, ada.id, true);
    let bobEvent = record(scope, bob.id);
    await events.insertMany([adaEvent, bobEvent]);
    await measurements.insertOne(record(scope, ada.id));
    await contentTexts.insertOne({
      _id: `${adaEvent._id}:0`,
      organizationId: scope.organization.id,
      projectId: scope.project.id,
      instanceId: scope.instance.id,
      recordId: adaEvent._id,
      index: 0,
      role: 'prompt',
      keyVersion: 1,
      iv: new mongoose.mongo.Binary(Buffer.from('iv')),
      ciphertext: new mongoose.mongo.Binary(Buffer.from('secret')),
      occurredAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    let adaSession = await scope.session({ observed: { userId: ada.id } });
    let bobSession = await scope.session({
      observed: { userId: bob.id },
      attribution: {
        entries: [
          { kind: 'user', entityId: bob.id, source: 'observed', weight: 1 },
          { kind: 'project', entityId: ada.id, source: 'manual', weight: 1 }
        ],
        dimIds: [bob.id, ada.id],
        version: 1,
        inputsHash: '',
        computedAt: new Date()
      },
      manual: [{ kind: 'project', entityId: ada.id, at: new Date() }]
    });

    let adaSlice = usageSlice(scope, ada.id, team.id);
    await usageSlices.insertOne(adaSlice);

    await userErasureService.eraseUser({ organization: scope.organization, user: ada });

    expect(
      (await testDb.ingestToken.findUniqueOrThrow({ where: { oid: ingestToken.oid } }))
        .revokedAt
    ).not.toBeNull();
    expect(queues.jobs).toEqual([
      { organizationId: scope.organization.id, userId: ada.id, phase: 'registry' }
    ]);

    await queues.drain();

    expect(await entity(ada.id)).toMatchObject({
      status: 'archived',
      name: null,
      attributes: {}
    });
    expect(await testDb.entityIdentifier.count({ where: { entityOid: ada.oid } })).toBe(0);
    expect(await entity(device.id)).toBeNull();
    expect(await entity(adaClient.id)).toBeNull();
    expect(await entity(sharedClient.id)).not.toBeNull();
    expect(
      await testDb.entityLink.findMany({
        where: { fromOid: sharedClient.oid },
        select: { toOid: true }
      })
    ).toEqual([{ toOid: bob.oid }]);
    expect(await testDb.pendingMembership.count()).toBe(0);
    expect(await getIdentityRedis().get(entityCacheKey(emailKey))).toBeNull();

    expect(await events.countDocuments({ _id: adaEvent._id })).toBe(0);
    expect(await events.countDocuments({ _id: bobEvent._id })).toBe(1);
    expect(await measurements.countDocuments({ organizationId: scope.organization.id })).toBe(
      0
    );
    expect(await contentTexts.countDocuments({ recordId: adaEvent._id })).toBe(0);

    expect(await sessions.findOne({ _id: adaSession._id })).toBeNull();
    let kept = (await sessions.findOne({ _id: bobSession._id }))!;
    expect(kept.attribution?.entries.map(entry => entry.entityId)).toEqual([bob.id]);
    expect(kept.attribution?.dimIds).toEqual([bob.id]);
    expect(kept.manual).toEqual([]);

    let anonymized = (await usageSlices.findOne({ _id: adaSlice._id }))!;
    expect(anonymized.userId).toBeUndefined();
    expect(anonymized.dims).toEqual([{ kind: 'team', id: team.id, w: 1 }]);
    expect(anonymized.dimIds).not.toContain(ada.id);

    expect(await entity(bob.id)).toMatchObject({ status: 'managed' });

    queues.jobs.push({
      organizationId: scope.organization.id,
      userId: ada.id,
      phase: 'registry'
    });
    expect(await queues.drain()).toBe(4);
  });

  it('deletes a vendor user and its slices in delete mode', async () => {
    let queues = queuedErasures();
    let scope = await setupScope();

    await testDb.organization.update({
      where: { oid: scope.organization.oid },
      data: { settings: { sliceErasureMode: 'delete' } }
    });

    let vendorUser = await entityService.upsertEntity({
      organization: scope.organization,
      input: {
        kind: 'user',
        identifiers: [{ type: 'account:cursor', value: 'vendor-ada' }]
      }
    });
    let team = await scope.entity({ kind: 'team', ref: 'payments' });

    let { usageSlices } = await collections();
    let slice = usageSlice(scope, vendorUser.id, team.id);
    await usageSlices.insertOne(slice);

    await userErasureService.eraseUser({
      organization: scope.organization,
      user: await testDb.entity.findUniqueOrThrow({ where: { id: vendorUser.id } })
    });
    await queues.drain();

    expect(await entity(vendorUser.id)).toBeNull();
    expect(await usageSlices.findOne({ _id: slice._id })).toBeNull();
  });

  it('only erases users', async () => {
    queuedErasures();
    let scope = await setupScope();

    let team = await scope.entity({ kind: 'team', ref: 'payments' });

    await expect(
      userErasureService.eraseUser({ organization: scope.organization, user: team })
    ).rejects.toMatchObject({ data: { code: 'bad_request' } });
  });
});
