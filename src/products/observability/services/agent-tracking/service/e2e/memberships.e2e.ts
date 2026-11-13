import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { agentTracking, rpcErrorCode } from './support';

let createOrganization = async () =>
  agentTracking().organization.upsert({ ref: uniqueId('org') });

let consumer = (organizationId: string, ref: string, email: string) =>
  agentTracking().entity.upsert({
    organizationId,
    kind: 'user',
    source: 'metorial.consumer',
    ref,
    identifiers: [{ type: 'email', value: email }]
  });

let team = (organizationId: string, slug: string, name?: string) =>
  agentTracking().entity.upsert({ organizationId, kind: 'team', ref: slug, slug, name });

let memberIds = async (organizationId: string, targetId: string) =>
  (
    await agentTracking().link.list({ organizationId, toId: targetId, types: ['member_of'] })
  ).items
    .map(link => link.from.id)
    .sort();

describe('memberships', () => {
  it('replaces members and applies pending emails when the user is synced', async () => {
    let organization = await createOrganization();

    let ada = await consumer(organization.id, 'con_ada', 'ada@acme.com');
    let platform = await team(organization.id, 'platform');

    let change = await agentTracking().memberships.replace({
      organizationId: organization.id,
      targetId: platform.id,
      members: [{ email: 'Ada@Acme.com' }, { email: 'later@acme.com', weight: 0.5 }],
      reach: 'past_30_days'
    });

    expect(change.object).toBe('agent_tracking#membership_change');
    expect(change.added.map(link => link.from.id)).toEqual([ada.id]);
    expect(change.pending.map(membership => membership.email)).toEqual(['later@acme.com']);

    let later = await consumer(organization.id, 'con_later', 'later@acme.com');

    expect(await memberIds(organization.id, platform.id)).toEqual([ada.id, later.id].sort());

    let links = await agentTracking().link.list({
      organizationId: organization.id,
      toId: platform.id
    });
    expect(links.items.find(link => link.from.id == later.id)!.weight).toBe(0.5);
  });

  it('adds and removes single members', async () => {
    let organization = await createOrganization();

    let ada = await consumer(organization.id, 'con_ada', 'ada@acme.com');
    let bob = await consumer(organization.id, 'con_bob', 'bob@acme.com');
    let platform = await team(organization.id, 'platform');

    await agentTracking().memberships.update({
      organizationId: organization.id,
      targetId: platform.id,
      add: [{ userId: ada.id }, { email: 'bob@acme.com' }]
    });
    expect(await memberIds(organization.id, platform.id)).toEqual([ada.id, bob.id].sort());

    let change = await agentTracking().memberships.update({
      organizationId: organization.id,
      targetId: platform.id,
      remove: [{ email: 'bob@acme.com' }]
    });
    expect(change.removed.map(link => link.from.id)).toEqual([bob.id]);
    expect(await memberIds(organization.id, platform.id)).toEqual([ada.id]);
  });

  it('rejects targets and members that are not valid', async () => {
    let organization = await createOrganization();

    let repo = await agentTracking().entity.upsert({
      organizationId: organization.id,
      kind: 'repo',
      ref: 'r'
    });
    let platform = await team(organization.id, 'platform');

    expect(
      await rpcErrorCode(
        agentTracking().memberships.replace({
          organizationId: organization.id,
          targetId: repo.id,
          members: []
        })
      )
    ).toBe('bad_request');
    expect(
      await rpcErrorCode(
        agentTracking().memberships.replace({
          organizationId: organization.id,
          targetId: platform.id,
          members: [{}]
        })
      )
    ).toBe('bad_request');
    expect(
      await rpcErrorCode(
        agentTracking().memberships.replace({
          organizationId: organization.id,
          targetId: platform.id,
          members: [{ email: 'a@acme.com', weight: -1 }]
        })
      )
    ).toBe('invalid_data');
  });

  it('imports a CSV as a dry run first and applies it after', async () => {
    let organization = await createOrganization();

    let ada = await consumer(organization.id, 'con_ada', 'ada@acme.com');
    let bob = await consumer(organization.id, 'con_bob', 'bob@acme.com');
    let platform = await team(organization.id, 'platform');
    let payments = await team(organization.id, 'payments', 'Payments');

    await agentTracking().memberships.replace({
      organizationId: organization.id,
      targetId: platform.id,
      members: [{ userId: ada.id }]
    });

    let csv = [
      'team,member email,weight',
      'platform,bob@acme.com,0.5',
      'Payments,ada@acme.com',
      'Payments,ghost@acme.com',
      'growth,ada@acme.com'
    ].join('\n');

    let dryRun = await agentTracking().memberships.import({
      organizationId: organization.id,
      csv
    });

    expect(dryRun).toMatchObject({ object: 'agent_tracking#membership_import', dryRun: true });
    expect(dryRun.unknownTeams).toEqual(['growth']);

    let platformDiff = dryRun.teams.find(entry => entry.target.id == platform.id)!;
    expect(platformDiff.added).toEqual([{ email: 'bob@acme.com', userId: bob.id }]);
    expect(platformDiff.removed).toEqual([{ email: 'ada@acme.com', userId: ada.id }]);

    let paymentsDiff = dryRun.teams.find(entry => entry.target.id == payments.id)!;
    expect(paymentsDiff.pending).toEqual([{ email: 'ghost@acme.com' }]);

    expect(await memberIds(organization.id, platform.id)).toEqual([ada.id]);

    expect(
      await rpcErrorCode(
        agentTracking().memberships.import({
          organizationId: organization.id,
          csv,
          dryRun: false
        })
      )
    ).toBe('bad_request');

    await agentTracking().memberships.import({
      organizationId: organization.id,
      csv: csv.split('\n').slice(0, 4).join('\n'),
      dryRun: false
    });

    expect(await memberIds(organization.id, platform.id)).toEqual([bob.id]);
    expect(await memberIds(organization.id, payments.id)).toEqual([ada.id]);
  });

  it('reports invalid CSV rows on dry runs', async () => {
    let organization = await createOrganization();

    await team(organization.id, 'platform');

    let result = await agentTracking().memberships.import({
      organizationId: organization.id,
      csv: 'platform,ada@acme.com\nplatform,not-an-email\n,bob@acme.com'
    });

    expect(result.errors.map(error => error.line)).toEqual([2, 3]);
    expect(result.teams[0]!.pending).toEqual([{ email: 'ada@acme.com' }]);
  });
});
