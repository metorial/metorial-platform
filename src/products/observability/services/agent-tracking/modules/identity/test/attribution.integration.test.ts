import { reattributionEvents } from '@mtsrc/agent-tracking-events';
import { captureEvents } from '@mtsrc/agent-tracking-events/test/events';
import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedRecord, SessionContextData } from '@mtsrc/agent-tracking-spec';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import { createOrganizationKeyDeriver } from '@mtsrc/agent-tracking-crypto';
import { ensureEntityStub } from '@mtsrc/agent-tracking-module-entities';
import type { PipelineContext } from '@mtsrc/agent-tracking-module-ingest';
import { archiveIdleEphemeralDevices } from '@mtsrc/agent-tracking-module-entities';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { entityService, linkService } from '@mtsrc/agent-tracking-module-entities';
import { buildDraft } from '@mtsrc/agent-tracking-dialects/test/build';
import {
  principalFixture,
  type PrincipalOverrides
} from '@mtsrc/agent-tracking-records-model/test/principal';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { cleanDatabase, testDb } from '@mtsrc/agent-tracking-db/test/setup';
import { entityCacheKey } from '../src/lib/cache';
import { closeRedis } from '@mtsrc/agent-tracking-redis';
import { createIdentityResolver, linkLockKey, newUserCounterKey } from '../src/lib/resolver';
import { createAttributionStage } from '../src/lib/stage';

captureEvents(reattributionEvents);

let redis = new Redis(process.env.REDIS_URL!);
let keys = createOrganizationKeyDeriver('unit-test-secret');
let now = new Date('2026-06-15T12:00:00.000Z');
let day = 24 * 60 * 60 * 1000;

afterAll(async () => {
  await redis.quit();
  await closeRedis();
});

let setup = async (instanceSettings: { ephemeralDeviceIdleDays?: number } = {}) => {
  let scope = await createTestScope({ instance: { settings: instanceSettings } });

  let user = await ensureEntityStub({
    organization: scope.organization,
    kind: 'user',
    source: 'metorial.consumer',
    ref: `con_${crypto.randomUUID()}`
  });

  let principalOf = (overrides: PrincipalOverrides = {}): IngestPrincipal =>
    principalFixture(
      { suffix: crypto.randomUUID().slice(0, 8) },
      {
        ...overrides,
        credential: { id: `atit_${scope.organization.id}`, ...overrides.credential },
        binding: {
          userId: user.id,
          deviceId: undefined,
          deviceMode: 'ephemeral',
          ...overrides.binding
        },
        organization: { id: scope.organization.id, ...overrides.organization },
        instance: { id: scope.instance.id, ...overrides.instance }
      }
    );

  let ingest = async (d: {
    principal: IngestPrincipal;
    drafts: Partial<RecordDraft>[];
    clientIp?: string;
    fresh?: boolean;
    resolver?: ReturnType<typeof createIdentityResolver>;
  }) => {
    let records: NormalizedRecord[] = d.drafts.map((overrides, index) =>
      buildDraft(
        {
          kind: 'event',
          type: 'prompt.submitted',
          identity: `${crypto.randomUUID()}-${index}`,
          client: { family: 'claude-code' },
          ctx: { sessionId: 's-1' },
          ...overrides
        },
        { principal: d.principal }
      )
    );

    let context: PipelineContext = {
      request: {
        requestId: 'req',
        principal: d.principal,
        clientIp: d.clientIp
      },
      lane: 'live',
      observedAt: now
    };

    let resolver = d.resolver ?? createIdentityResolver({ redis });
    await createAttributionStage({ resolver, keys }).beforeWrite!(context, records);

    return records;
  };

  return { ...scope, user, principalOf, ingest };
};

let entitiesOf = async (organizationOid: bigint, kind: string) =>
  await testDb.entity.findMany({
    where: { organizationOid, kind },
    include: { identifiers: true },
    orderBy: { oid: 'asc' }
  });

let activeLinks = async (organizationOid: bigint) =>
  await testDb.entityLink.findMany({
    where: { organizationOid, validTo: null },
    include: { from: true, to: true }
  });

describe('attribution against postgres and redis', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('ephemeral devices', () => {
    it('creates one device per token and client ip and reuses it', async () => {
      let { organization, user, principalOf, ingest } = await setup();
      let principal = principalOf();

      let first = await ingest({ principal, drafts: [{}, {}], clientIp: '203.0.113.7' });
      let second = await ingest({ principal, drafts: [{}], clientIp: '203.0.113.7' });
      let other = await ingest({ principal, drafts: [{}], clientIp: '198.51.100.1' });

      let devices = await entitiesOf(organization.oid, 'device');

      expect(devices).toHaveLength(2);
      expect(devices[0]).toMatchObject({
        status: 'discovered',
        attributes: { ephemeral: true, ip: '203.0.113.7', tokenId: principal.credential.id }
      });
      expect(
        devices[0]?.identifiers.map(identifier => [identifier.type, identifier.value])
      ).toEqual([['ip', `${principal.credential.id}:203.0.113.7`]]);
      expect(
        new Set([...first, ...second].map(record => record.attribution?.device_id))
      ).toEqual(new Set([devices[0]!.id]));
      expect(other[0]?.attribution?.device_id).toBe(devices[1]!.id);
      expect(first[0]?.attribution?.user_id).toBe(user.id);

      let links = await activeLinks(organization.oid);
      expect(
        links.map(link => [link.type, link.origin, link.from.id, link.to.id]).sort()
      ).toEqual(
        [
          ['owned_by', 'observed', devices[0]!.id, user.id],
          ['owned_by', 'observed', devices[1]!.id, user.id]
        ].sort()
      );
    });

    it('touches last seen', async () => {
      let { organization, principalOf, ingest } = await setup();

      await ingest({ principal: principalOf(), drafts: [{}], clientIp: '203.0.113.7' });

      let [device] = await entitiesOf(organization.oid, 'device');
      expect(device?.lastSeenAt).not.toBeNull();
    });

    it('creates no duplicates under concurrency', async () => {
      let { organization, principalOf, ingest } = await setup();
      let principal = principalOf();

      await Promise.all(
        Array.from({ length: 8 }, () =>
          ingest({
            principal,
            drafts: [
              {
                actor: {
                  install_id: 'inst-1',
                  user: { id: 'acct-1' },
                  identity_source: 'client_claim'
                }
              }
            ],
            clientIp: '203.0.113.7'
          })
        )
      );

      for (let kind of ['device', 'agent', 'client_user', 'client_installation']) {
        expect(await entitiesOf(organization.oid, kind), kind).toHaveLength(1);
      }

      let links = await activeLinks(organization.oid);
      expect(
        links.map(link => `${link.from.kind}>${link.type}>${link.to.kind}`).sort()
      ).toEqual([
        'client_installation>part_of>device',
        'client_user>owned_by>user',
        'device>owned_by>user'
      ]);
    });
  });

  describe('agents, client users and installations', () => {
    it('discovers the agent per family and adopts it when the metorial sync arrives', async () => {
      let { organization, principalOf, ingest } = await setup();

      let [record] = await ingest({ principal: principalOf(), drafts: [{}] });
      let [agent] = await entitiesOf(organization.oid, 'agent');

      expect(agent).toMatchObject({ status: 'discovered', id: record?.attribution?.agent_id });

      let synced = await entityService.upsertEntity({
        organization,
        input: {
          kind: 'agent',
          source: 'metorial.client',
          ref: 'claude-code',
          name: 'Claude Code',
          identifiers: [{ type: 'client_family', value: 'claude-code' }]
        }
      });

      expect(synced).toMatchObject({ id: agent!.id, status: 'managed' });
    });

    it('resolves client users and installations once and links them', async () => {
      let { organization, user, principalOf, ingest } = await setup();
      let principal = principalOf({ binding: { deviceMode: 'bound' } });
      let device = await ensureEntityStub({
        organization,
        kind: 'device',
        source: 'metorial.device',
        ref: 'dev-1'
      });
      principal.binding.deviceId = device.id;

      let actor = {
        install_id: 'inst-1',
        user: { id: 'acct-1', email: 'dev@example.com' },
        identity_source: 'client_claim' as const
      };

      let first = await ingest({ principal, drafts: [{ actor }, { actor }] });
      let second = await ingest({ principal, drafts: [{ actor }] });

      let [clientUser] = await entitiesOf(organization.oid, 'client_user');
      let [installation] = await entitiesOf(organization.oid, 'client_installation');

      expect(clientUser?.identifiers.map(identifier => identifier.type).sort()).toEqual([
        'account:claude-code',
        'email:claude-code'
      ]);
      expect(
        new Set([...first, ...second].map(record => record.attribution?.client_user_id))
      ).toEqual(new Set([clientUser!.id]));
      expect(second[0]?.attribution?.client_installation_id).toBe(installation!.id);

      let links = await activeLinks(organization.oid);
      expect(links.map(link => [link.from.id, link.type, link.to.id]).sort()).toEqual(
        [
          [clientUser!.id, 'owned_by', user.id],
          [installation!.id, 'part_of', device.id]
        ].sort()
      );
    });

    it('flags a client email that is not the token user email', async () => {
      let { organization, principalOf, ingest } = await setup();
      let owner = await entityService.upsertEntity({
        organization,
        input: {
          kind: 'user',
          source: 'metorial.consumer',
          ref: 'con_owner',
          identifiers: [{ type: 'email', value: 'owner@acme.com' }]
        }
      });

      let principal = principalOf({ binding: { userId: owner.id } });
      let records = await ingest({
        principal,
        drafts: [
          { actor: { user: { email: 'owner@acme.com' }, identity_source: 'client_claim' } },
          { actor: { user: { email: 'intruder@acme.com' }, identity_source: 'client_claim' } }
        ]
      });

      expect(
        records.map(record =>
          record.quality.warnings.includes('identity_conflict:client_email')
        )
      ).toEqual([false, true]);
    });
  });

  describe('vendor sources', () => {
    let vendorPrincipal = (
      principalOf: (overrides?: PrincipalOverrides) => IngestPrincipal,
      overrides: PrincipalOverrides = {}
    ) =>
      principalOf({
        credential: { kind: 'source', id: `atis_${crypto.randomUUID()}`, family: 'cursor' },
        binding: { userId: undefined, deviceMode: 'vendor' },
        ...overrides
      });

    let vendorActor = (email: string) => ({
      client: { family: 'cursor' },
      actor: { user: { email }, identity_source: 'client_claim' as const }
    });

    it('matches managed users by email and discovers unknown ones', async () => {
      let { organization, principalOf, ingest } = await setup();
      let ada = await entityService.upsertEntity({
        organization,
        input: {
          kind: 'user',
          source: 'metorial.consumer',
          ref: 'con_ada',
          identifiers: [{ type: 'email', value: 'ada@acme.com' }]
        }
      });

      let records = await ingest({
        principal: vendorPrincipal(principalOf),
        drafts: [vendorActor('ADA@acme.com'), vendorActor('bob@acme.com')]
      });

      expect(records[0]?.attribution?.user_id).toBe(ada.id);

      let bob = await testDb.entity.findUniqueOrThrow({
        where: { id: records[1]!.attribution!.user_id! }
      });
      expect(bob).toMatchObject({ status: 'discovered', needsReview: false });

      let adopted = await entityService.upsertEntity({
        organization,
        input: {
          kind: 'user',
          source: 'metorial.consumer',
          ref: 'con_bob',
          identifiers: [{ type: 'email', value: 'bob@acme.com' }]
        }
      });
      expect(adopted).toMatchObject({ id: bob.id, status: 'managed' });
    });

    it('flags new users beyond the daily limit for review', async () => {
      let { principalOf, ingest } = await setup();
      let principal = vendorPrincipal(principalOf, { newUserLimitPerDay: 2 });

      let records = await ingest({
        principal,
        drafts: ['a', 'b', 'c', 'a'].map(name => vendorActor(`${name}@acme.com`))
      });

      let users = await testDb.entity.findMany({
        where: { id: { in: records.map(record => record.attribution!.user_id!) } },
        include: { identifiers: true }
      });
      let reviewByEmail = Object.fromEntries(
        users.map(user => [user.identifiers[0]!.value, user.needsReview])
      );

      expect(Object.values(reviewByEmail).filter(Boolean)).toHaveLength(1);
      expect(Object.keys(reviewByEmail).sort()).toEqual([
        'a@acme.com',
        'b@acme.com',
        'c@acme.com'
      ]);
      expect(await redis.get(newUserCounterKey(principal.credential.id, now))).toBe('3');
    });

    it('flags users outside the allowed email domains', async () => {
      let { principalOf, ingest } = await setup();

      let [record] = await ingest({
        principal: vendorPrincipal(principalOf, {
          organization: { settings: { allowedEmailDomains: ['acme.com'] } }
        }),
        drafts: [vendorActor('someone@gmail.com')]
      });

      let user = await testDb.entity.findUniqueOrThrow({
        where: { id: record!.attribution!.user_id! }
      });
      expect(user.needsReview).toBe(true);
    });
  });

  describe('repos, workspaces and source tags', () => {
    it('resolves the repo and workspace and links them', async () => {
      let { organization, principalOf, ingest } = await setup();
      let principal = principalOf();

      let context = {
        type: 'session.context',
        data: {
          source: 'hook',
          repo: { provider: 'github.com', owner: 'metorial', name: 'platform' }
        },
        content: [{ role: 'path' as const, value: '/Users/dev/platform' }]
      };

      let [first] = await ingest({ principal, drafts: [context] });
      let [second] = await ingest({ principal, drafts: [context] });

      let [repo] = await entitiesOf(organization.oid, 'repo');
      let [workspace] = await entitiesOf(organization.oid, 'workspace');

      expect(repo).toMatchObject({ status: 'discovered', name: 'metorial/platform' });
      expect(repo?.identifiers.map(identifier => identifier.value)).toEqual([
        'github.com/metorial/platform'
      ]);
      expect(workspace?.identifiers.map(identifier => identifier.value)).toEqual([
        (first!.data as SessionContextData).workspace!.root_hash
      ]);
      expect(second?.attribution).toMatchObject({
        repo_id: repo!.id,
        workspace_id: workspace!.id
      });

      let links = await activeLinks(organization.oid);
      expect(links.find(link => link.from.kind == 'workspace')).toMatchObject({
        type: 'part_of',
        origin: 'observed',
        toOid: repo!.oid
      });
    });

    it('emits credential tags once per session across batches', async () => {
      let { principalOf, ingest } = await setup();
      let principal = principalOf({ tags: [{ key: 'metorial.team', value: 'core' }] });
      principal.credential.id = `atit_${crypto.randomUUID()}`;

      let first = await ingest({ principal, drafts: [{}, {}] });
      let second = await ingest({ principal, drafts: [{}] });

      let tagged = (records: NormalizedRecord[]) =>
        records.filter(record => record.source.adapter == 'metorial');

      expect(tagged(first)).toHaveLength(1);
      expect(tagged(second)).toHaveLength(0);
      expect(tagged(first)[0]?.data).toEqual({
        source: 'credential',
        tags: [{ k: 'metorial.team', v: 'core', origin: 'source' }]
      });
    });
  });

  describe('admin decisions and entity changes', () => {
    it('never recreates an observed link an admin ended', async () => {
      let { organization, user, principalOf, ingest } = await setup();
      let principal = principalOf();

      let [record] = await ingest({ principal, drafts: [{}], clientIp: '203.0.113.7' });
      let deviceId = record!.attribution!.device_id!;

      let [observed] = await activeLinks(organization.oid);
      expect(observed).toMatchObject({ type: 'owned_by', origin: 'observed' });

      await linkService.endLink({
        organization,
        link: await linkService.getLinkById({ organization, linkId: observed!.id }),
        reach: 'from_now'
      });

      await redis.del(
        linkLockKey(organization.id, { fromId: deviceId, toId: user.id, type: 'owned_by' })
      );
      await ingest({ principal, drafts: [{}], clientIp: '203.0.113.7' });

      expect(await activeLinks(organization.oid)).toHaveLength(0);
      expect(
        await testDb.entityLink.count({ where: { organizationOid: organization.oid } })
      ).toBe(1);
    });

    it('keeps an ended workspace link ended', async () => {
      let { organization, principalOf, ingest } = await setup();
      let principal = principalOf();

      let context = {
        type: 'session.context',
        data: {
          source: 'hook',
          repo: { provider: 'github.com', owner: 'metorial', name: 'platform' }
        },
        content: [{ role: 'path' as const, value: '/Users/dev/platform' }]
      };

      let [record] = await ingest({ principal, drafts: [context] });
      let { repo_id: repoId, workspace_id: workspaceId } = record!.attribution!;

      let link = (await activeLinks(organization.oid)).find(
        candidate => candidate.from.kind == 'workspace'
      )!;
      await linkService.endLink({
        organization,
        link: await linkService.getLinkById({ organization, linkId: link.id }),
        reach: 'from_now'
      });

      await redis.del(
        linkLockKey(organization.id, { fromId: workspaceId!, toId: repoId!, type: 'part_of' })
      );
      await ingest({ principal, drafts: [context] });

      expect(
        (await activeLinks(organization.oid)).filter(
          candidate => candidate.from.kind == 'workspace'
        )
      ).toHaveLength(0);
    });

    it('resolves a merged entity to the winner despite the cache', async () => {
      let { organization, principalOf, ingest } = await setup();
      let principal = principalOf({
        credential: { kind: 'source', id: `atis_${crypto.randomUUID()}`, family: 'cursor' },
        binding: { userId: undefined, deviceMode: 'vendor' }
      });
      let resolver = createIdentityResolver({ redis });
      let actor = {
        client: { family: 'cursor' },
        actor: {
          user: { email: 'merge.me@acme.com' },
          identity_source: 'client_claim' as const
        }
      };

      let [first] = await ingest({ principal, resolver, drafts: [actor] });
      let loserId = first!.attribution!.user_id!;

      expect(
        await redis.get(
          entityCacheKey({
            organizationId: organization.id,
            kind: 'user',
            type: 'email',
            value: 'merge.me@acme.com'
          })
        )
      ).toBe(loserId);

      let winner = await entityService.upsertEntity({
        organization,
        input: {
          kind: 'user',
          source: 'metorial.consumer',
          ref: 'con_winner',
          identifiers: [{ type: 'email', value: 'winner@acme.com' }]
        }
      });
      await entityService.mergeEntities({
        organization,
        winner: await testDb.entity.findUniqueOrThrow({ where: { id: winner.id } }),
        loser: await testDb.entity.findUniqueOrThrow({ where: { id: loserId } })
      });

      let [second] = await ingest({ principal, resolver, drafts: [actor] });

      expect(second!.attribution!.user_id).toBe(winner.id);
    });

    it('drops cache entries for identifiers removed by identifiers.set', async () => {
      let { organization, principalOf, ingest } = await setup();
      let principal = principalOf({
        credential: { kind: 'source', id: `atis_${crypto.randomUUID()}`, family: 'cursor' },
        binding: { userId: undefined, deviceMode: 'vendor' }
      });
      let resolver = createIdentityResolver({ redis });
      let actor = {
        client: { family: 'cursor' },
        actor: { user: { email: 'old@acme.com' }, identity_source: 'client_claim' as const }
      };

      let [first] = await ingest({ principal, resolver, drafts: [actor] });
      let entity = await testDb.entity.findUniqueOrThrow({
        where: { id: first!.attribution!.user_id! }
      });

      await entityService.setIdentifiers({
        organization,
        entity,
        types: ['email'],
        identifiers: [{ type: 'email', value: 'new@acme.com' }]
      });

      let [second] = await ingest({ principal, resolver, drafts: [actor] });

      expect(second!.attribution!.user_id).not.toBe(entity.id);
    });
  });

  describe('ephemeral device archival', () => {
    it('archives idle ephemeral devices and clears their cache entries', async () => {
      let { organization, principalOf, ingest } = await setup({ ephemeralDeviceIdleDays: 3 });
      let principal = principalOf();

      let [idle] = await ingest({ principal, drafts: [{}], clientIp: '203.0.113.7' });
      let [active] = await ingest({ principal, drafts: [{}], clientIp: '198.51.100.1' });

      let idleId = idle!.attribution!.device_id!;
      let activeId = active!.attribution!.device_id!;

      await testDb.entity.update({
        where: { id: idleId },
        data: { lastSeenAt: new Date(Date.now() - 4 * day) }
      });
      await testDb.entity.update({
        where: { id: activeId },
        data: { lastSeenAt: new Date(Date.now() - 2 * day) }
      });

      let managed = await ensureEntityStub({
        organization,
        kind: 'device',
        source: 'metorial.device',
        ref: 'managed'
      });
      await testDb.entity.update({
        where: { oid: managed.oid },
        data: { lastSeenAt: new Date(Date.now() - 30 * day) }
      });

      let cacheKey = entityCacheKey({
        organizationId: organization.id,
        kind: 'device',
        type: 'ip',
        value: `${principal.credential.id}:203.0.113.7`
      });
      expect(await redis.get(cacheKey)).toBe(idleId);

      expect(await archiveIdleEphemeralDevices({ organization })).toEqual({ archived: 1 });

      let statuses = Object.fromEntries(
        (await entitiesOf(organization.oid, 'device')).map(device => [
          device.id,
          device.status
        ])
      );
      expect(statuses).toEqual({
        [idleId]: 'archived',
        [activeId]: 'discovered',
        [managed.id]: 'managed'
      });
      expect(await redis.get(cacheKey)).toBeNull();

      let [again] = await ingest({ principal, drafts: [{}], clientIp: '203.0.113.7' });
      expect(again?.attribution?.device_id).not.toBe(idleId);
    });
  });
});
