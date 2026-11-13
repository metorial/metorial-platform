import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { groundstation, rpcErrorCode } from './support';

let setup = async () => {
  let organization = await groundstation().organization.upsert({ ref: uniqueId('org') });
  let billing = await groundstation().entity.upsert({
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

    let rule = await groundstation().rule.create({
      organizationId: organization.id,
      name: 'Acme repos',
      targetEntityId: billing.id,
      priority: 5,
      match: { all: [acmeRepos, { not: { field: 'branch', op: 'glob', value: 'scratch/*' } }] }
    });

    expect(rule).toMatchObject({
      object: 'groundstation#attribution_rule',
      name: 'Acme repos',
      effect: 'assign',
      priority: 5,
      enabled: true,
      target: expect.objectContaining({ id: billing.id }),
      scope: { projectId: null, instanceId: null },
      archivedAt: null
    });
    expect(Date.now() - new Date(rule.validFrom).getTime()).toBeLessThan(60_000);

    let updated = await groundstation().rule.update({
      organizationId: organization.id,
      ruleId: rule.id,
      enabled: false,
      match: acmeRepos
    });
    expect(updated).toMatchObject({ enabled: false, match: acmeRepos });

    let fetched = await groundstation().rule.get({
      organizationId: organization.id,
      ruleId: rule.id
    });
    expect(fetched.id).toBe(rule.id);

    let listed = await groundstation().rule.list({
      organizationId: organization.id,
      targetEntityIds: [billing.id]
    });
    expect(listed.items.map(item => item.id)).toEqual([rule.id]);

    let deleted = await groundstation().rule.delete({
      organizationId: organization.id,
      ruleId: rule.id,
      reach: 'past_30_days'
    });
    expect(deleted.archivedAt).not.toBeNull();

    expect(
      await rpcErrorCode(
        groundstation().rule.get({ organizationId: organization.id, ruleId: rule.id })
      )
    ).toBe('not_found');
    expect(
      (await groundstation().rule.list({ organizationId: organization.id })).items
    ).toEqual([]);
  });

  it('rejects invalid matches and targets', async () => {
    let { organization, billing } = await setup();

    let create = (match: unknown, targetEntityId: string = billing.id) =>
      rpcErrorCode(
        groundstation().rule.create({
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

    let ada = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'user',
      source: 'metorial.consumer',
      ref: 'con_ada',
      identifiers: [{ type: 'email', value: 'ada@acme.com' }]
    });
    expect(await create(acmeRepos, ada.id)).toBe('bad_request');
    expect(await create(acmeRepos, 'gen_missing')).toBe('not_found');
  });

  it('tests a draft rule without sessions', async () => {
    let { organization, billing } = await setup();

    let result = await groundstation().rule.test({
      organizationId: organization.id,
      targetEntityId: billing.id,
      match: acmeRepos
    });

    expect(result).toEqual({
      object: 'groundstation#attribution_rule_test',
      sessionsEvaluated: 0,
      sessionsMatched: 0,
      sessionsChanged: 0,
      truncated: false,
      samples: []
    });
  });
});
