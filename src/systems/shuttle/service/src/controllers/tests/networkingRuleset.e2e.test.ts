import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { shuttleClient } from '../../test/client';

describe('networkingRuleset:create E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a networking ruleset for a tenant', async () => {
    const tenant = await f.tenant.default();

    const result = await shuttleClient.networkingRuleset.create({
      tenantId: tenant.id,
      name: 'Allow HTTPS',
      description: 'Allow outbound HTTPS',
      defaultAction: 'accept',
      rules: [
        {
          action: 'accept',
          protocol: 'tcp',
          destination: '10.0.0.0/24',
          port: 443
        }
      ]
    });

    expect(result).toMatchObject({
      name: 'Allow HTTPS',
      description: 'Allow outbound HTTPS',
      defaultAction: 'accept',
      rules: [
        {
          action: 'accept',
          protocol: 'tcp',
          destination: '10.0.0.0/24',
          portRange: {
            end: 443,
            start: 443
          }
        }
      ],
      tenantId: tenant.id
    });
  });
});

describe('networkingRuleset:list/get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns networking rulesets for a tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');

    const rulesetA1 = await f.networkingRuleset.default({ tenantOid: tenantA.oid });
    const rulesetA2 = await f.networkingRuleset.default({ tenantOid: tenantA.oid });
    const rulesetB = await f.networkingRuleset.default({ tenantOid: tenantB.oid });

    const result = await shuttleClient.networkingRuleset.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: rulesetA1.id,
          name: rulesetA1.name,
          status: rulesetA1.status,
          tenantId: tenantA.id
        }),
        expect.objectContaining({
          id: rulesetA2.id,
          name: rulesetA2.name,
          status: rulesetA2.status,
          tenantId: tenantA.id
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: rulesetB.id
        }
      ])
    );
  });

  it('returns a single networking ruleset by ID', async () => {
    const tenant = await f.tenant.default();
    const ruleset = await f.networkingRuleset.default({ tenantOid: tenant.oid });

    const result = await shuttleClient.networkingRuleset.get({
      tenantId: tenant.id,
      networkingRulesetId: ruleset.id
    });

    expect(result).toMatchObject({
      id: ruleset.id,
      name: ruleset.name,
      status: ruleset.status,
      tenantId: tenant.id,
      defaultAction: ruleset.rules.defaultAction,
      rules: ruleset.rules.rules
    });
  });
});
