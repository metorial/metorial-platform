import { reattributionEvents } from '@mtsrc/agent-tracking-events';
import { captureEvents } from '@mtsrc/agent-tracking-events/test/events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { entityService } from '../src/services/entity';
import { linkService } from '../src/services/link';
import { membershipService } from '../src/services/membership';
import { expectServiceError } from '@mtsrc/agent-tracking-testing';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { cleanDatabase, testDb } from '@mtsrc/agent-tracking-db/test/setup';
import { loadActiveLinks, reachableEntities } from '../src/lib/graph';
import { findOrCreateDiscovered } from '../src/lib/resolve';

let requestReattribution = captureEvents(reattributionEvents);

let day = 24 * 60 * 60 * 1000;

let setup = async () => {
  let scope = await createTestScope();

  let entity = async (input: Parameters<typeof entityService.upsertEntity>[0]['input']) => {
    let created = await entityService.upsertEntity({
      organization: scope.organization,
      input
    });

    return await testDb.entity.findUniqueOrThrow({ where: { id: created.id } });
  };

  let user = (ref: string, email: string) =>
    entity({
      kind: 'user',
      source: 'metorial.consumer',
      ref,
      identifiers: [{ type: 'email', value: email }]
    });

  return { ...scope, entity, user };
};

let activeMembers = async (targetOid: bigint) =>
  (
    await testDb.entityLink.findMany({
      where: { toOid: targetOid, validTo: null },
      include: { from: true }
    })
  )
    .map(link => link.from.ref)
    .sort();

describe('links and memberships', () => {
  beforeEach(async () => {
    await cleanDatabase();
    vi.mocked(requestReattribution).mockClear();
  });

  describe('link.upsert', () => {
    it('validates kind compatibility and reuses the active link', async () => {
      let { entity, user, organization } = await setup();

      let ada = await user('ada', 'ada@acme.com');
      let team = await entity({ kind: 'team', ref: 'team' });
      let repo = await entity({ kind: 'repo', ref: 'repo' });

      let first = await linkService.upsertLink({
        organization,
        from: ada,
        to: team,
        input: { type: 'member_of', reach: 'from_now' }
      });
      let second = await linkService.upsertLink({
        organization,
        from: ada,
        to: team,
        input: { type: 'member_of', weight: 0.5, reach: 'past_30_days' }
      });

      expect(second.id).toBe(first.id);
      expect(second.weight).toBe(0.5);
      expect(Date.now() - second.validFrom.getTime()).toBeGreaterThan(29 * day);
      expect(requestReattribution).toHaveBeenLastCalledWith(
        expect.objectContaining({ entityIds: [ada.id, team.id] })
      );

      await expectServiceError(
        linkService.upsertLink({
          organization,
          from: repo,
          to: team,
          input: { type: 'part_of', reach: 'from_now' }
        }),
        'bad_request'
      );
      await expectServiceError(
        linkService.upsertLink({
          organization,
          from: team,
          to: team,
          input: { type: 'part_of', reach: 'from_now' }
        }),
        'bad_request'
      );
    });

    it('ends links within the reach window', async () => {
      let { entity, user, organization } = await setup();

      let ada = await user('ada', 'ada@acme.com');
      let team = await entity({ kind: 'team', ref: 'team' });

      let created = await linkService.upsertLink({
        organization,
        from: ada,
        to: team,
        input: { type: 'member_of', reach: 'past_30_days' }
      });
      let ended = await linkService.endLink({
        organization,
        link: created,
        reach: 'from_now'
      });

      expect(ended.validTo).not.toBeNull();
      expect(ended.validTo!.getTime()).toBeGreaterThan(ended.validFrom.getTime());

      let list = await (await linkService.listLinks({ organization, toId: team.id })).run({});
      expect(list.items).toHaveLength(0);

      let all = await (
        await linkService.listLinks({ organization, toId: team.id, includeEnded: true })
      ).run({});
      expect(all.items).toHaveLength(1);
    });
  });

  describe('link.replaceSet', () => {
    it('ends removed links, keeps unchanged ones and adds new ones', async () => {
      let { entity, user, organization } = await setup();

      let [a, b, c] = [
        await user('a', 'a@acme.com'),
        await user('b', 'b@acme.com'),
        await user('c', 'c@acme.com')
      ];
      let team = await entity({ kind: 'team', ref: 'team' });

      await linkService.replaceLinkSet({
        organization,
        to: team,
        input: {
          type: 'member_of',
          reach: 'from_now',
          members: [{ entity: a }, { entity: b }]
        }
      });
      expect(await activeMembers(team.oid)).toEqual(['a', 'b']);

      vi.mocked(requestReattribution).mockClear();

      let result = await linkService.replaceLinkSet({
        organization,
        to: team,
        input: {
          type: 'member_of',
          reach: 'past_30_days',
          members: [{ entity: b }, { entity: c, weight: 0.5 }]
        }
      });

      expect(result.added.map(link => link.from.ref)).toEqual(['c']);
      expect(result.removed.map(link => link.from.ref)).toEqual(['a']);
      expect(result.kept.map(link => link.from.ref)).toEqual(['b']);
      expect(Date.now() - result.added[0]!.validFrom.getTime()).toBeGreaterThan(29 * day);
      expect(result.removed[0]!.validTo).toEqual(result.removed[0]!.validFrom);
      expect(await activeMembers(team.oid)).toEqual(['b', 'c']);

      let request = vi.mocked(requestReattribution).mock.calls[0]![0];
      expect(request.entityIds?.sort()).toEqual([a.id, c.id, team.id].sort());
    });
  });

  describe('memberships.replace', () => {
    it('links known users, keeps unknown emails pending and applies them when the user appears', async () => {
      let { entity, user, organization } = await setup();

      let ada = await user('ada', 'ada@acme.com');
      let team = await entity({ kind: 'team', ref: 'team', slug: 'platform' });

      let change = await membershipService.replaceMemberships({
        organization,
        target: team,
        input: {
          members: [{ email: 'ADA@acme.com' }, { email: 'later@acme.com', weight: 0.3 }],
          reach: 'past_30_days'
        }
      });

      expect(change.added.map(link => link.from.id)).toEqual([ada.id]);
      expect(change.pending.map(membership => membership.email)).toEqual(['later@acme.com']);

      let pendingFrom = change.pending[0]!.validFrom;

      let { entity: later } = await findOrCreateDiscovered({
        organization,
        kind: 'user',
        identifiers: [{ type: 'email', value: 'later@acme.com' }]
      });

      let link = await testDb.entityLink.findFirstOrThrow({
        where: { fromOid: later.oid, toOid: team.oid }
      });
      expect(link).toMatchObject({ type: 'member_of', weight: 0.3, validTo: null });
      expect(link.validFrom).toEqual(pendingFrom);
      expect(
        await testDb.pendingMembership.count({ where: { targetEntityOid: team.oid } })
      ).toBe(0);

      let cleared = await membershipService.replaceMemberships({
        organization,
        target: team,
        input: { members: [], reach: 'from_now' }
      });
      expect(cleared.removed).toHaveLength(2);
    });

    it('applies pending memberships when a managed user adopts the email', async () => {
      let { entity, user, organization } = await setup();

      let team = await entity({ kind: 'team', ref: 'team' });

      await membershipService.replaceMemberships({
        organization,
        target: team,
        input: { members: [{ email: 'new@acme.com' }], reach: 'from_now' }
      });

      let created = await user('con_new', 'new@acme.com');

      expect(await activeMembers(team.oid)).toEqual(['con_new']);
      expect(created.status).toBe('managed');
    });

    it('rejects targets users cannot be members of', async () => {
      let { entity, organization } = await setup();

      let repo = await entity({ kind: 'repo', ref: 'repo' });

      await expectServiceError(
        membershipService.replaceMemberships({
          organization,
          target: repo,
          input: { members: [], reach: 'from_now' }
        }),
        'bad_request'
      );
    });
  });

  describe('memberships.update', () => {
    it('adds and removes single members', async () => {
      let { entity, user, organization } = await setup();

      let ada = await user('ada', 'ada@acme.com');
      let bob = await user('bob', 'bob@acme.com');
      let team = await entity({ kind: 'team', ref: 'team' });

      await membershipService.updateMemberships({
        organization,
        target: team,
        input: {
          add: [{ userId: ada.id }, { email: 'bob@acme.com' }, { email: 'pending@acme.com' }],
          remove: [],
          reach: 'from_now'
        }
      });
      expect(await activeMembers(team.oid)).toEqual(['ada', 'bob']);

      let change = await membershipService.updateMemberships({
        organization,
        target: team,
        input: {
          add: [],
          remove: [{ userId: bob.id }, { email: 'pending@acme.com' }],
          reach: 'from_now'
        }
      });

      expect(change.removed.map(link => link.from.id)).toEqual([bob.id]);
      expect(await activeMembers(team.oid)).toEqual(['ada']);
      expect(
        await testDb.pendingMembership.count({ where: { targetEntityOid: team.oid } })
      ).toBe(0);
    });
  });

  describe('memberships.import', () => {
    it('returns a diff on dry runs and applies it otherwise', async () => {
      let { entity, user, organization } = await setup();

      let ada = await user('ada', 'ada@acme.com');
      await user('bob', 'bob@acme.com');
      let platform = await entity({ kind: 'team', ref: 'platform', slug: 'platform' });
      await entity({ kind: 'team', ref: 'payments', name: 'Payments Team' });

      await membershipService.replaceMemberships({
        organization,
        target: platform,
        input: { members: [{ userId: ada.id }], reach: 'from_now' }
      });

      let csv = [
        'team,email,weight',
        'Platform,bob@acme.com,0.5',
        'payments team,ada@acme.com',
        'payments team,ghost@acme.com',
        'growth,ada@acme.com'
      ].join('\n');

      let dryRun = await membershipService.importMemberships({
        organization,
        input: { csv, dryRun: true, reach: 'from_now' }
      });

      expect(dryRun.unknownTeams).toEqual(['growth']);

      let platformDiff = dryRun.teams.find(team => team.target.ref == 'platform')!;
      expect(platformDiff.added.map(member => member.email)).toEqual(['bob@acme.com']);
      expect(platformDiff.removed.map(member => member.email)).toEqual(['ada@acme.com']);

      let paymentsDiff = dryRun.teams.find(team => team.target.ref == 'payments')!;
      expect(paymentsDiff.added.map(member => member.email)).toEqual(['ada@acme.com']);
      expect(paymentsDiff.pending).toEqual([{ email: 'ghost@acme.com' }]);

      expect(await activeMembers(platform.oid)).toEqual(['ada']);

      await expectServiceError(
        membershipService.importMemberships({
          organization,
          input: { csv, dryRun: false, reach: 'from_now' }
        }),
        'bad_request'
      );

      let applied = await membershipService.importMemberships({
        organization,
        input: {
          csv: csv.split('\n').slice(0, 4).join('\n'),
          dryRun: false,
          reach: 'from_now'
        }
      });

      expect(applied.unknownTeams).toEqual([]);
      expect(await activeMembers(platform.oid)).toEqual(['bob']);
      expect(
        await testDb.pendingMembership.count({ where: { email: 'ghost@acme.com' } })
      ).toBe(1);
    });
  });

  describe('graph', () => {
    it('loads links valid at a time and walks them', async () => {
      let { entity, user, organization } = await setup();

      let ada = await user('ada', 'ada@acme.com');
      let team = await entity({ kind: 'team', ref: 'team' });
      let cc = await entity({ kind: 'cost_center', ref: 'cc' });

      await linkService.upsertLink({
        organization,
        from: ada,
        to: team,
        input: { type: 'member_of', reach: 'past_30_days' }
      });
      await linkService.upsertLink({
        organization,
        from: team,
        to: cc,
        input: { type: 'part_of', reach: 'from_now' }
      });

      let tenDaysAgo = new Date(Date.now() - 10 * day);
      let past = await loadActiveLinks({ organizationOid: organization.oid, at: tenDaysAgo });
      expect(
        reachableEntities([ada.id], past, tenDaysAgo).map(entry => entry.entityId)
      ).toEqual([team.id]);

      let now = new Date(Date.now() + 1000);
      let current = await loadActiveLinks({ organizationOid: organization.oid, at: now });
      expect(
        reachableEntities([ada.id], current, now)
          .map(entry => entry.entityId)
          .sort()
      ).toEqual([team.id, cc.id].sort());
    });
  });
});
