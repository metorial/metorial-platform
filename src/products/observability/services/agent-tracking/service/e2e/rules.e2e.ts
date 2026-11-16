import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { agentTracking, rpcErrorCode } from './support';

let setup = async () => {
  let organization = await agentTracking().organization.upsert({ ref: uniqueId('org') });
  let billing = await agentTracking().entity.upsert({
    organizationId: organization.id,
    kind: 'project',
    ref: 'billing',
    slug: 'billing'
  });

  return { organization, billing };
};

let acmeRepos = { field: 'repo.owner', op: 'eq' as const, value: 'acme' };

describe('attribution rules', () => {
  it('creates, updates, lists and deletes a rule', async () => {
    let { organization, billing } = await setup();

    let rule = await agentTracking().rule.create({
      organizationId: organization.id,
      name: 'Acme repos',
      targetEntityId: billing.id,
      priority: 5,
      match: { all: [acmeRepos, { not: { field: 'branch', op: 'glob', value: 'scratch/*' } }] }
    });

    expect(rule).toMatchObject({
      object: 'agent_tracking#attribution_rule',
      name: 'Acme repos',
      effect: 'assign',
      priority: 5,
      enabled: true,
      target: expect.objectContaining({ id: billing.id }),
      scope: { projectId: null, instanceId: null },
      archivedAt: null
    });
    expect(Date.now() - new Date(rule.validFrom).getTime()).toBeLessThan(60_000);

    let updated = await agentTracking().rule.update({
      organizationId: organization.id,
      ruleId: rule.id,
      enabled: false,
      match: acmeRepos
    });
    expect(updated).toMatchObject({ enabled: false, match: acmeRepos });

    let fetched = await agentTracking().rule.get({
      organizationId: organization.id,
      ruleId: rule.id
    });
    expect(fetched.id).toBe(rule.id);

    let listed = await agentTracking().rule.list({
      organizationId: organization.id,
      targetEntityIds: [billing.id]
    });
    expect(listed.items.map(item => item.id)).toEqual([rule.id]);

    let deleted = await agentTracking().rule.delete({
      organizationId: organization.id,
      ruleId: rule.id,
      reach: 'past_30_days'
    });
    expect(deleted.archivedAt).not.toBeNull();

    expect(
      await rpcErrorCode(
        agentTracking().rule.get({ organizationId: organization.id, ruleId: rule.id })
      )
    ).toBe('not_found');
    expect(
      (await agentTracking().rule.list({ organizationId: organization.id })).items
    ).toEqual([]);
  });

  it('rejects invalid matches and targets', async () => {
    let { organization, billing } = await setup();

    let create = (match: unknown, targetEntityId: string = billing.id) =>
      rpcErrorCode(
        agentTracking().rule.create({
          organizationId: organization.id,
          name: 'Broken',
          targetEntityId,
          match: match as typeof acmeRepos
        })
      );

    expect(await create({ field: 'cost', op: 'eq', value: '1' })).toBe('invalid_data');
    expect(await create({ field: 'branch', op: 'regex', value: '(a+)+' })).toBe(
      'invalid_data'
    );
    expect(await create({ field: 'repo', op: 'in', value: 'acme/api' })).toBe('invalid_data');
    expect(await create({ any: [] })).toBe('invalid_data');

    let ada = await agentTracking().entity.upsert({
      organizationId: organization.id,
      kind: 'user',
      source: 'metorial.consumer',
      ref: 'con_ada',
      identifiers: [{ type: 'email', value: 'ada@acme.com' }]
    });
    expect(await create(acmeRepos, ada.id)).toBe('bad_request');
    expect(await create(acmeRepos, 'aten_missing')).toBe('not_found');
  });

  it('tests a draft rule without sessions', async () => {
    let { organization, billing } = await setup();

    let result = await agentTracking().rule.test({
      organizationId: organization.id,
      targetEntityId: billing.id,
      match: acmeRepos
    });

    expect(result).toEqual({
      object: 'agent_tracking#attribution_rule_test',
      sessionsEvaluated: 0,
      sessionsMatched: 0,
      sessionsChanged: 0,
      truncated: false,
      samples: []
    });
  });
});
