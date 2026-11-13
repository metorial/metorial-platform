import { reattributionEvents } from '@mtsrc/agent-tracking-events';
import { captureEvents } from '@mtsrc/agent-tracking-events/test/events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eraseEntitiesChunk } from '@mtsrc/agent-tracking-module-entities';
import {
  entityKindService,
  entityService,
  linkService,
  mergeSuggestionService
} from '@mtsrc/agent-tracking-module-entities';
import { ingestTokenService } from '../../src/services/ingestToken';
import { expectServiceError } from '@mtsrc/agent-tracking-testing';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { cleanDatabase, testDb } from '@mtsrc/agent-tracking-db/test/setup';
import { entityResolutionService } from '@mtsrc/agent-tracking-module-entities';

let requestReattribution = captureEvents(reattributionEvents);
let onEntitiesMerged = captureEvents(['entities.entity.merged:after']);

let day = 24 * 60 * 60 * 1000;

let setup = async () => {
  let scope = await createTestScope();

  let upsert = (input: Parameters<typeof entityService.upsertEntity>[0]['input']) =>
    entityService.upsertEntity({ organization: scope.organization, input });

  let discover = (
    kind: string,
    identifiers: { type: string; value: string }[],
    extra: { name?: string; needsReview?: boolean } = {}
  ) =>
    entityResolutionService.findOrCreateDiscovered({
      organization: scope.organization,
      kind,
      identifiers,
      ...extra
    });

  return { ...scope, upsert, discover };
};

describe('entity registry', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.mocked(requestReattribution).mockClear();
    vi.mocked(onEntitiesMerged).mockClear();
  });

  describe('upsert', () => {
    it('is idempotent on kind, source and ref', async () => {
      let { upsert, organization } = await setup();

      let first = await upsert({
        kind: 'team',
        ref: 'team-1',
        name: 'Platform',
        slug: 'Platform',
        attributes: { color: 'blue' }
      });
      let second = await upsert({ kind: 'team', ref: 'team-1', attributes: { size: 4 } });

      expect(second.id).toBe(first.id);
      expect(first).toMatchObject({ status: 'managed', source: 'customer', slug: 'platform' });
      expect(second.name).toBe('Platform');
      expect(second.attributes).toEqual({ color: 'blue', size: 4 });

      let rows = await testDb.entity.findMany({
        where: { organizationOid: organization.oid, kind: 'team' }
      });
      expect(rows).toHaveLength(1);
    });

    it('finds customer entities by slug when there is no ref', async () => {
      let { upsert } = await setup();

      let first = await upsert({ kind: 'project', slug: 'billing', name: 'Billing' });
      let second = await upsert({ kind: 'project', slug: 'billing', name: 'Billing revamp' });

      expect(second.id).toBe(first.id);
      expect(second.name).toBe('Billing revamp');
    });

    it('keeps slugs unique per kind and validates them', async () => {
      let { upsert } = await setup();

      await upsert({ kind: 'team', ref: 'a', slug: 'core' });
      let project = await upsert({ kind: 'project', ref: 'p', slug: 'core' });
      expect(project.slug).toBe('core');

      await expectServiceError(upsert({ kind: 'team', ref: 'b', slug: 'core' }), 'conflict');
      await expectServiceError(
        upsert({ kind: 'team', ref: 'c', slug: '-bad' }),
        'bad_request'
      );
    });

    it('requires custom kinds to be defined first', async () => {
      let { upsert, organization } = await setup();

      await expectServiceError(upsert({ kind: 'custom:department', ref: 'eng' }), 'not_found');

      await entityKindService.upsertKind({
        organization,
        input: { key: 'custom:department', name: 'Department' }
      });

      let entity = await upsert({ kind: 'custom:department', ref: 'eng' });
      expect(entity.kind).toBe('custom:department');
    });

    it('limits entities to a project or instance scope', async () => {
      let { upsert, project, instance } = await setup();

      let byInstance = await upsert({
        kind: 'team',
        ref: 't',
        scope: { instanceId: instance.id }
      });
      expect(byInstance.scopeProject?.id).toBe(project.id);
      expect(byInstance.scopeInstance?.id).toBe(instance.id);

      let cleared = await upsert({ kind: 'team', ref: 't', scope: null });
      expect(cleared.scopeProject).toBeNull();
      expect(cleared.scopeInstance).toBeNull();

      await expectServiceError(
        upsert({ kind: 'team', ref: 'u', scope: { projectId: 'missing' } }),
        'not_found'
      );
    });
  });

  describe('discovery and adoption', () => {
    it('creates a discovered user once and matches any identifier afterwards', async () => {
      let { discover, organization } = await setup();

      let first = await discover('user', [{ type: 'email', value: 'Ada@Acme.com' }], {
        name: 'Ada',
        needsReview: true
      });
      expect(first.created).toBe(true);
      expect(first.entity).toMatchObject({
        status: 'discovered',
        needsReview: true,
        name: 'Ada'
      });

      let second = await discover('user', [
        { type: 'account:cursor', value: 'u-1' },
        { type: 'email', value: 'ada@acme.com' }
      ]);
      expect(second.created).toBe(false);
      expect(second.entity.id).toBe(first.entity.id);

      let byAccount = await entityResolutionService.findByIdentifier({
        organizationOid: organization.oid,
        kind: 'user',
        type: 'account:cursor',
        value: 'u-1'
      });
      expect(byAccount?.id).toBe(first.entity.id);
    });

    it('never moves an identifier another entity owns', async () => {
      let { discover } = await setup();

      let ada = await discover('user', [{ type: 'email', value: 'ada@acme.com' }]);
      let bob = await discover('user', [{ type: 'email', value: 'bob@acme.com' }]);

      let claim = await discover('user', [
        { type: 'email', value: 'bob@acme.com' },
        { type: 'email', value: 'ada@acme.com' }
      ]);

      expect(claim.entity.id).toBe(bob.entity.id);

      let adaIdentifiers = await testDb.entityIdentifier.findMany({
        where: { entityOid: ada.entity.oid }
      });
      expect(adaIdentifiers.map(identifier => identifier.value)).toEqual(['ada@acme.com']);
    });

    it('is race-safe when many requests discover the same user', async () => {
      let { discover, organization } = await setup();

      let results = await Promise.all(
        Array.from({ length: 12 }, () =>
          discover('user', [
            { type: 'email', value: 'race@acme.com' },
            { type: 'account:claude_code', value: 'acc-1' }
          ])
        )
      );

      expect(new Set(results.map(result => result.entity.id)).size).toBe(1);
      expect(results.filter(result => result.created)).toHaveLength(1);

      let users = await testDb.entity.findMany({
        where: { organizationOid: organization.oid, kind: 'user' }
      });
      expect(users).toHaveLength(1);
    });

    it('adopts a discovered user when Metorial syncs a consumer with that email', async () => {
      let { discover, upsert } = await setup();

      let discovered = await discover('user', [{ type: 'email', value: 'john@acme.com' }]);

      let managed = await upsert({
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_1',
        name: 'John',
        identifiers: [{ type: 'email', value: ' JOHN@acme.com' }]
      });

      expect(managed.id).toBe(discovered.entity.id);
      expect(managed).toMatchObject({
        status: 'managed',
        source: 'metorial.consumer',
        ref: 'con_1',
        name: 'John'
      });

      let again = await upsert({ kind: 'user', source: 'metorial.consumer', ref: 'con_1' });
      expect(again.id).toBe(discovered.entity.id);
    });

    it('merges further discovered users whose identifiers the managed user claims', async () => {
      let { discover, upsert } = await setup();

      let byEmail = await discover('user', [{ type: 'email', value: 'kim@acme.com' }]);
      let byAccount = await discover('user', [{ type: 'account:cursor', value: 'kim-1' }]);

      let managed = await upsert({
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_kim',
        identifiers: [
          { type: 'email', value: 'kim@acme.com' },
          { type: 'account:cursor', value: 'kim-1' }
        ]
      });

      expect(managed.id).toBe(byEmail.entity.id);
      expect(managed.identifiers.map(identifier => identifier.type).sort()).toEqual([
        'account:cursor',
        'email'
      ]);

      let loser = await testDb.entity.findUniqueOrThrow({
        where: { oid: byAccount.entity.oid }
      });
      expect(loser.status).toBe('merged');
      expect(loser.mergedIntoOid).toBe(byEmail.entity.oid);
      expect(onEntitiesMerged).toHaveBeenCalledWith(
        expect.objectContaining({ winnerId: managed.id, loserId: byAccount.entity.id })
      );

      let resolved = await entityResolutionService.findByIdentifier({
        organizationOid: loser.organizationOid,
        kind: 'user',
        type: 'account:cursor',
        value: 'kim-1'
      });
      expect(resolved?.id).toBe(managed.id);
    });

    it('moves a managed identifier between managed users', async () => {
      let { upsert } = await setup();

      let old = await upsert({
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_old',
        identifiers: [{ type: 'email', value: 'shared@acme.com' }]
      });
      let next = await upsert({
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_new',
        identifiers: [{ type: 'email', value: 'shared@acme.com' }]
      });

      expect(next.id).not.toBe(old.id);
      expect(next.identifiers.map(identifier => identifier.value)).toEqual([
        'shared@acme.com'
      ]);

      let reloaded = await testDb.entity.findUniqueOrThrow({ where: { id: old.id } });
      expect(reloaded.status).toBe('managed');

      let oldIdentifiers = await testDb.entityIdentifier.count({
        where: { entity: { id: old.id } }
      });
      expect(oldIdentifiers).toBe(0);
    });
  });

  describe('identifiers.set', () => {
    it('replaces the identifiers of the given types only', async () => {
      let { upsert, organization } = await setup();

      let user = await upsert({
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_x',
        identifiers: [
          { type: 'email', value: 'x@acme.com' },
          { type: 'email', value: 'x.old@acme.com' },
          { type: 'profile:cop', value: 'p1' }
        ]
      });
      let entity = await testDb.entity.findUniqueOrThrow({ where: { id: user.id } });

      let updated = await entityService.setIdentifiers({
        organization,
        entity,
        types: ['email'],
        identifiers: [
          { type: 'email', value: 'x@acme.com' },
          { type: 'email', value: 'X.New@acme.com' }
        ]
      });

      expect(
        updated.identifiers.map(identifier => `${identifier.type}:${identifier.value}`).sort()
      ).toEqual(['email:x.new@acme.com', 'email:x@acme.com', 'profile:cop:p1']);

      await expectServiceError(
        entityService.setIdentifiers({
          organization,
          entity,
          types: ['email'],
          identifiers: [{ type: 'profile:cop', value: 'p2' }]
        }),
        'bad_request'
      );
    });
  });

  describe('merge', () => {
    it('moves identifiers, links and tokens to the winner and closes suggestions', async () => {
      let { upsert, discover, organization, instance } = await setup();

      let team = await upsert({ kind: 'team', ref: 'team', slug: 'team' });
      let other = await upsert({ kind: 'team', ref: 'other', slug: 'other' });
      let teamEntity = await testDb.entity.findUniqueOrThrow({ where: { id: team.id } });
      let otherEntity = await testDb.entity.findUniqueOrThrow({ where: { id: other.id } });

      let { ingestToken } = await ingestTokenService.createIngestToken({
        organization,
        instance,
        input: { name: 'ci', userRef: 'con_ci', deviceMode: 'ephemeral' }
      });
      let winner = await testDb.entity.findUniqueOrThrow({
        where: { oid: ingestToken.userEntityOid }
      });

      let loser = (await discover('user', [{ type: 'email', value: 'ci@acme.com' }])).entity;

      let device = await discover('device', [{ type: 'ip', value: 'atit_x:10.0.0.1' }]);
      await testDb.ingestToken.update({
        where: { oid: ingestToken.oid },
        data: { userEntityOid: loser.oid }
      });

      await linkService.upsertLink({
        organization,
        from: loser,
        to: teamEntity,
        input: { type: 'member_of', reach: 'from_now' }
      });
      await linkService.upsertLink({
        organization,
        from: winner,
        to: teamEntity,
        input: { type: 'member_of', reach: 'past_30_days' }
      });
      await linkService.upsertLink({
        organization,
        from: loser,
        to: otherEntity,
        input: { type: 'member_of', reach: 'from_now' }
      });
      await linkService.upsertLink({
        organization,
        from: device.entity,
        to: loser,
        input: { type: 'owned_by', reach: 'from_now' }
      });

      let suggestion = await testDb.mergeSuggestion.create({
        data: {
          oid: 1n,
          id: 'atms_test',
          score: 0.5,
          reasons: ['email_local_part'],
          organizationOid: organization.oid,
          discoveredEntityOid: loser.oid,
          managedEntityOid: winner.oid
        }
      });

      let merged = await entityService.mergeEntities({ organization, winner, loser });

      expect(merged.id).toBe(winner.id);
      expect(merged.identifiers.map(identifier => identifier.value)).toEqual(['ci@acme.com']);

      let loserRow = await testDb.entity.findUniqueOrThrow({ where: { oid: loser.oid } });
      expect(loserRow).toMatchObject({ status: 'merged', mergedIntoOid: winner.oid });

      let links = await testDb.entityLink.findMany({
        where: { OR: [{ fromOid: winner.oid }, { toOid: winner.oid }] }
      });
      expect(links.filter(link => link.toOid == teamEntity.oid)).toHaveLength(1);
      expect(links.filter(link => link.toOid == otherEntity.oid)).toHaveLength(1);
      expect(links.filter(link => link.fromOid == device.entity.oid)).toHaveLength(1);
      expect(
        await testDb.entityLink.count({
          where: { OR: [{ fromOid: loser.oid }, { toOid: loser.oid }] }
        })
      ).toBe(0);

      let token = await testDb.ingestToken.findUniqueOrThrow({
        where: { oid: ingestToken.oid }
      });
      expect(token.userEntityOid).toBe(winner.oid);

      let closed = await testDb.mergeSuggestion.findUniqueOrThrow({
        where: { oid: suggestion.oid }
      });
      expect(closed.status).toBe('accepted');

      expect(onEntitiesMerged).toHaveBeenCalledWith({
        organizationId: organization.id,
        winnerId: winner.id,
        loserId: loser.id,
        tokenPrefixes: expect.any(Array)
      });
    });

    it('rejects invalid merges', async () => {
      let { upsert, discover, organization } = await setup();

      let managedA = await testDb.entity.findUniqueOrThrow({
        where: {
          id: (await upsert({ kind: 'user', source: 'metorial.consumer', ref: 'a' })).id
        }
      });
      let managedB = await testDb.entity.findUniqueOrThrow({
        where: {
          id: (await upsert({ kind: 'user', source: 'metorial.consumer', ref: 'b' })).id
        }
      });
      let team = await testDb.entity.findUniqueOrThrow({
        where: { id: (await upsert({ kind: 'team', ref: 't' })).id }
      });
      let discovered = (await discover('user', [{ type: 'email', value: 'd@acme.com' }]))
        .entity;

      await expectServiceError(
        entityService.mergeEntities({ organization, winner: managedA, loser: managedA }),
        'bad_request'
      );
      await expectServiceError(
        entityService.mergeEntities({ organization, winner: managedA, loser: team }),
        'bad_request'
      );
      await expectServiceError(
        entityService.mergeEntities({ organization, winner: managedA, loser: managedB }),
        'precondition_failed'
      );
      await expectServiceError(
        entityService.mergeEntities({ organization, winner: discovered, loser: managedA }),
        'bad_request'
      );
    });
  });

  describe('archive', () => {
    it('releases identifiers, frees the slug and ends active links', async () => {
      let { upsert, discover, organization } = await setup();

      let team = await upsert({ kind: 'team', ref: 'team', slug: 'web' });
      let teamEntity = await testDb.entity.findUniqueOrThrow({ where: { id: team.id } });
      let user = (await discover('user', [{ type: 'email', value: 'u@acme.com' }])).entity;

      await linkService.upsertLink({
        organization,
        from: user,
        to: teamEntity,
        input: { type: 'member_of', reach: 'from_now' }
      });

      let archivedUser = await entityService.archiveEntity({ organization, entity: user });
      let archivedTeam = await entityService.archiveEntity({
        organization,
        entity: teamEntity
      });

      expect(archivedUser.status).toBe('archived');
      expect(archivedUser.identifiers).toEqual([]);
      expect(archivedTeam.slug).toBeNull();

      let link = await testDb.entityLink.findFirstOrThrow({
        where: { toOid: teamEntity.oid }
      });
      expect(link.validTo).not.toBeNull();

      let fresh = await discover('user', [{ type: 'email', value: 'u@acme.com' }]);
      expect(fresh.created).toBe(true);
      expect((await upsert({ kind: 'team', ref: 'web2', slug: 'web' })).slug).toBe('web');
    });
  });

  describe('lists', () => {
    it('filters by kind, status, scope, search and needsReview', async () => {
      let { upsert, discover, organization, project } = await setup();

      await upsert({ kind: 'team', ref: 'a', name: 'Alpha Team', slug: 'alpha' });
      await upsert({ kind: 'team', ref: 'b', name: 'Beta', scope: { projectId: project.id } });
      await discover('user', [{ type: 'email', value: 'needle@acme.com' }], {
        needsReview: true
      });

      let page = async (
        input: Omit<Parameters<typeof entityService.listEntities>[0], 'organization'>
      ) =>
        (
          await (
            await entityService.listEntities({ organization, ...input })
          ).run({ limit: 50 })
        ).items;

      expect((await page({ kinds: ['team'] })).map(entity => entity.name).sort()).toEqual([
        'Alpha Team',
        'Beta'
      ]);
      expect(await page({ statuses: ['discovered'] })).toHaveLength(1);
      expect((await page({ search: 'alp' })).map(entity => entity.slug)).toEqual(['alpha']);
      expect(await page({ search: 'NEEDLE' })).toHaveLength(1);
      expect(await page({ needsReview: true })).toHaveLength(1);

      let other = await createTestScope();
      let otherProjectScoped = await page({
        kinds: ['team'],
        scope: { projectId: project.id }
      });
      expect(otherProjectScoped).toHaveLength(2);
      expect(
        await (await entityService.listEntities({ organization: other.organization })).run({})
      ).toMatchObject({ items: [] });
    });
  });

  describe('kinds', () => {
    it('stores overrides and custom kinds and re-attributes when tag origins change', async () => {
      let { organization } = await setup();

      await entityKindService.upsertKind({
        organization,
        input: { key: 'project', name: 'Initiative', cardinality: 'multi' }
      });
      expect(requestReattribution).not.toHaveBeenCalled();

      await entityKindService.upsertKind({
        organization,
        input: { key: 'project', attributes: { tagOrigins: ['source'] } }
      });
      expect(requestReattribution).toHaveBeenCalledTimes(1);

      let call = vi.mocked(requestReattribution).mock.calls[0]![0];
      expect(call.organizationId).toBe(organization.id);
      expect(Date.now() - call.since.getTime()).toBeGreaterThan(29 * day);

      await entityKindService.upsertKind({
        organization,
        input: { key: 'custom:department', name: 'Department' }
      });

      let kinds = await entityKindService.listKinds({ organization });
      expect(kinds.find(kind => kind.key == 'project')).toMatchObject({
        name: 'Initiative',
        cardinality: 'multi',
        tagOrigins: ['source']
      });
      expect(kinds.at(-1)).toMatchObject({ key: 'custom:department', builtIn: false });

      await expectServiceError(
        entityKindService.upsertKind({
          organization,
          input: { key: 'user', attributes: { tagOrigins: ['source'] } }
        }),
        'bad_request'
      );
      await expectServiceError(
        entityKindService.upsertKind({
          organization,
          input: { key: 'department', name: 'x' }
        }),
        'bad_request'
      );
    });
  });

  describe('touchLastSeen', () => {
    it('only writes when lastSeenAt is older than the resolution', async () => {
      let { discover } = await setup();

      let { entity } = await discover('device', [{ type: 'host_id', value: 'h1' }]);
      let seenAt = entity.lastSeenAt!;

      await entityResolutionService.touchLastSeen({
        entityIds: [entity.id],
        at: new Date(seenAt.getTime() + 60_000)
      });
      let unchanged = await testDb.entity.findUniqueOrThrow({ where: { oid: entity.oid } });
      expect(unchanged.lastSeenAt).toEqual(seenAt);

      let later = new Date(seenAt.getTime() + 10 * 60_000);
      await entityResolutionService.touchLastSeen({
        entityIds: [entity.id, entity.id],
        at: later
      });
      let touched = await testDb.entity.findUniqueOrThrow({ where: { oid: entity.oid } });
      expect(touched.lastSeenAt).toEqual(later);
      expect(touched.firstSeenAt).toEqual(entity.firstSeenAt);
    });
  });

  describe('erasure', () => {
    it('erases scoped entities only and anonymizes token-bound ones on organization erasure', async () => {
      let { upsert, discover, organization, project, instance } = await setup();

      let scoped = await upsert({
        kind: 'team',
        ref: 'scoped',
        scope: { projectId: project.id }
      });
      let global = await upsert({ kind: 'team', ref: 'global', name: 'Global' });
      let user = (await discover('user', [{ type: 'email', value: 'e@acme.com' }])).entity;

      let { ingestToken } = await ingestTokenService.createIngestToken({
        organization,
        instance,
        input: { name: 'laptop', userRef: 'con_bound', deviceRef: 'dev_bound' }
      });

      await eraseEntitiesChunk({ organizationId: organization.id, projectId: project.id });

      expect(await testDb.entity.findUnique({ where: { id: scoped.id } })).toBeNull();
      expect(await testDb.entity.findUnique({ where: { id: global.id } })).not.toBeNull();

      await eraseEntitiesChunk({ organizationId: organization.id });

      expect(await testDb.entity.findUnique({ where: { id: global.id } })).toBeNull();
      expect(await testDb.entity.findUnique({ where: { oid: user.oid } })).toBeNull();
      expect(
        await testDb.entityIdentifier.count({ where: { organizationOid: organization.oid } })
      ).toBe(0);

      let bound = await testDb.entity.findUniqueOrThrow({
        where: { oid: ingestToken.userEntityOid }
      });
      expect(bound).toMatchObject({ status: 'archived', name: null, attributes: {} });
    });
  });

  describe('merge suggestions', () => {
    it('suggests discovered users that look like managed users and never reopens dismissed ones', async () => {
      let { upsert, discover, organization } = await setup();

      await upsert({
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_john',
        name: 'John Doe',
        identifiers: [{ type: 'email', value: 'john.doe@acme.com' }]
      });
      await upsert({
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_ada',
        name: 'Ada Lovelace',
        identifiers: [{ type: 'email', value: 'ada@acme.com' }]
      });
      let john = (await discover('user', [{ type: 'email', value: 'john@acme.com' }])).entity;

      await mergeSuggestionService.refreshMergeSuggestions({ organization });

      let open = await (
        await mergeSuggestionService.listMergeSuggestions({ organization })
      ).run({});
      expect(open.items).toHaveLength(1);
      expect(open.items[0]!.discoveredEntity.id).toBe(john.id);
      expect(open.items[0]!.managedEntity.ref).toBe('con_john');
      expect(open.items[0]!.reasons).toEqual(['email_local_part_prefix']);

      await mergeSuggestionService.dismissMergeSuggestion({ mergeSuggestion: open.items[0]! });
      await mergeSuggestionService.refreshMergeSuggestions({ organization });

      let after = await (
        await mergeSuggestionService.listMergeSuggestions({ organization })
      ).run({});
      expect(after.items).toHaveLength(0);
      expect(
        await testDb.mergeSuggestion.count({ where: { organizationOid: organization.oid } })
      ).toBe(1);
    });
  });
});
