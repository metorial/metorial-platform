import { beforeEach, describe, expect, it } from 'vitest';
import type {
  SlateInstance,
  SlateTriggerGroup,
  SlateWebhookRegistration,
  Tenant,
  TriggerRegistrationInstance
} from '../../prisma/generated/client';
import { getId, snowflake } from '../id';
import { triggerRoutingMatcherServiceInternal } from '../internal/triggerRoutingMatcherServiceInternal';
import { fixtures } from './fixtures';
import { cleanDatabase, testDb } from './setup';

describe('triggerRoutingMatcherServiceInternal', () => {
  let f = fixtures(testDb);

  let scenario: {
    triggerGroup: SlateTriggerGroup;
    tenantA: Tenant;
    tenantB: Tenant;
    instanceA: TriggerRegistrationInstance;
    instanceB: TriggerRegistrationInstance;
    tenantWebhook: SlateWebhookRegistration;
    globalWebhook: SlateWebhookRegistration;
    automatedWebhook: SlateWebhookRegistration;
  };

  let setMatchers = (
    tenantOid: bigint,
    instance: TriggerRegistrationInstance,
    matchers: Record<string, any>[]
  ) =>
    triggerRoutingMatcherServiceInternal.setInstanceMatchers({
      tenantOid,
      triggerGroupOid: scenario.triggerGroup.oid,
      triggerRegistrationInstanceOid: instance.oid,
      matchers
    });

  /** Routes the given events and reports which instances each one reached. */
  let route = async (
    webhookRegistration: SlateWebhookRegistration,
    events: { matchers: Record<string, any>[] }[]
  ) => {
    let matched = await triggerRoutingMatcherServiceInternal.matchWebhookEvents({
      webhookRegistration,
      events
    });

    return matched.map(m => ({
      event: events.indexOf(m.event),
      instanceOids: m.triggerRegistrationInstanceOids.map(String).sort()
    }));
  };

  let link = (instance: TriggerRegistrationInstance, webhook: SlateWebhookRegistration) =>
    testDb.triggerRegistrationWebhook.create({
      data: {
        oid: snowflake.nextId(),
        triggerRegistrationInstanceOid: instance.oid,
        webhookRegistrationOid: webhook.oid
      }
    });

  beforeEach(async () => {
    await cleanDatabase();

    let slate = await f.slate.complete();
    let specification = slate.currentVersion.specification;

    let triggerGroup = await testDb.slateTriggerGroup.create({
      data: {
        ...getId('slateTriggerGroup'),
        identifier: `tg-${crypto.randomUUID()}`,
        hash: 'hash',
        key: 'messages',
        name: 'Messages',
        spec: {
          id: 'messages',
          name: 'Messages',
          invocation: { type: 'webhook', registration: { mode: 'manual' } }
        } as any,
        slateOid: slate.oid,
        mostRecentSpecificationOid: specification.oid
      }
    });

    let configSchema = await f.slateConfigSchema.default({
      slateOid: slate.oid,
      specificationOid: specification.oid
    });

    let makeRegistrationInstance = async (tenantOid: bigint) => {
      let slateInstance: SlateInstance = await testDb.slateInstance.create({
        data: { ...getId('slateInstance'), slateOid: slate.oid, tenantOid }
      });
      let config = await f.slateInstanceConfig.default({
        instanceOid: slateInstance.oid,
        schemaOid: configSchema.oid,
        tenantOid
      });
      let registration = await testDb.triggerRegistration.create({
        data: {
          ...getId('triggerRegistration'),
          tenantOid,
          slateOid: slate.oid,
          instanceOid: slateInstance.oid,
          instanceConfigOid: config.oid
        }
      });

      return testDb.triggerRegistrationInstance.create({
        data: {
          ...getId('triggerRegistrationInstance'),
          triggerRegistrationOid: registration.oid,
          triggerGroupOid: triggerGroup.oid
        }
      });
    };

    let makeWebhookRegistration = async (d: {
      type: 'manual' | 'automated';
      owner: 'tenant' | 'global';
      tenantOid: bigint | null;
      secretTenantOid: bigint;
    }) => {
      let secret = await f.secret.default({
        tenantOid: d.secretTenantOid,
        type: 'slate_webhook_registration_payload'
      });

      return testDb.slateWebhookRegistration.create({
        data: {
          ...getId('slateWebhookRegistration'),
          type: d.type,
          owner: d.owner,
          status: 'active',
          urlKey: crypto.randomUUID(),
          name: 'Test webhook',
          slateOid: slate.oid,
          triggerGroupOid: triggerGroup.oid,
          tenantOid: d.tenantOid,
          secretOid: secret.oid
        }
      });
    };

    let tenantA = await f.tenant.default();
    let tenantB = await f.tenant.default();

    scenario = {
      triggerGroup,
      tenantA,
      tenantB,
      instanceA: await makeRegistrationInstance(tenantA.oid),
      instanceB: await makeRegistrationInstance(tenantB.oid),
      tenantWebhook: await makeWebhookRegistration({
        type: 'manual',
        owner: 'tenant',
        tenantOid: tenantA.oid,
        secretTenantOid: tenantA.oid
      }),
      globalWebhook: await makeWebhookRegistration({
        type: 'manual',
        owner: 'global',
        tenantOid: null,
        secretTenantOid: tenantA.oid
      }),
      automatedWebhook: await makeWebhookRegistration({
        type: 'automated',
        owner: 'tenant',
        tenantOid: tenantA.oid,
        secretTenantOid: tenantA.oid
      })
    };

    await link(scenario.instanceA, scenario.tenantWebhook);
    await link(scenario.instanceB, scenario.globalWebhook);
  });

  describe('setInstanceMatchers', () => {
    it('drops matchers that carry no values', async () => {
      let count = await setMatchers(scenario.tenantA.oid, scenario.instanceA, [
        { team_id: 'T1', user_id: 'U1' },
        { team_id: 'T1' },
        {},
        { nested: {} }
      ]);

      expect(count).toBe(2);
    });

    it('shares one row between instances of different tenants only by tenant', async () => {
      await setMatchers(scenario.tenantA.oid, scenario.instanceA, [
        { team_id: 'T1', user_id: 'U1' }
      ]);
      // Same values, written in a different key order, for a different tenant.
      await setMatchers(scenario.tenantB.oid, scenario.instanceB, [
        { user_id: 'U1', team_id: 'T1' }
      ]);

      let rows = await testDb.triggerRoutingMatcher.findMany({
        where: { triggerGroupOid: scenario.triggerGroup.oid }
      });

      expect(rows).toHaveLength(2);
      expect(new Set(rows.map(row => row.hash)).size).toBe(1);
    });

    it('is idempotent', async () => {
      let matchers = [{ team_id: 'T1', user_id: 'U1' }, { team_id: 'T1' }];

      await setMatchers(scenario.tenantA.oid, scenario.instanceA, matchers);
      expect(await setMatchers(scenario.tenantA.oid, scenario.instanceA, matchers)).toBe(2);

      expect(
        await testDb.triggerRoutingMatcher.count({
          where: { triggerGroupOid: scenario.triggerGroup.oid }
        })
      ).toBe(2);
      expect(
        await triggerRoutingMatcherServiceInternal.countInstanceMatchers({
          triggerRegistrationInstanceOid: scenario.instanceA.oid
        })
      ).toBe(2);
    });

    it('prunes links for matchers that are no longer present', async () => {
      await setMatchers(scenario.tenantA.oid, scenario.instanceA, [
        { team_id: 'T1', user_id: 'U1' },
        { team_id: 'T1' }
      ]);

      expect(
        await setMatchers(scenario.tenantA.oid, scenario.instanceA, [{ team_id: 'T1' }])
      ).toBe(1);
      expect(
        await route(scenario.tenantWebhook, [{ matchers: [{ team_id: 'T1', user_id: 'U1' }] }])
      ).toEqual([]);
      expect(await route(scenario.tenantWebhook, [{ matchers: [{ team_id: 'T1' }] }])).toEqual(
        [{ event: 0, instanceOids: [String(scenario.instanceA.oid)] }]
      );
    });

    it('removes every link when there are no matchers left', async () => {
      await setMatchers(scenario.tenantA.oid, scenario.instanceA, [{ team_id: 'T1' }]);

      expect(await setMatchers(scenario.tenantA.oid, scenario.instanceA, [])).toBe(0);
      expect(
        await triggerRoutingMatcherServiceInternal.countInstanceMatchers({
          triggerRegistrationInstanceOid: scenario.instanceA.oid
        })
      ).toBe(0);
    });
  });

  describe('matchWebhookEvents', () => {
    let a = () => String(scenario.instanceA.oid);
    let b = () => String(scenario.instanceB.oid);

    beforeEach(async () => {
      await setMatchers(scenario.tenantA.oid, scenario.instanceA, [
        { team_id: 'T1', user_id: 'U1' },
        { team_id: 'T1' }
      ]);
      await setMatchers(scenario.tenantB.oid, scenario.instanceB, [
        { team_id: 'T1', user_id: 'U1' }
      ]);
    });

    it('routes an exactly equal matcher, whatever its key order', async () => {
      expect(
        await route(scenario.tenantWebhook, [{ matchers: [{ team_id: 'T1', user_id: 'U1' }] }])
      ).toEqual([{ event: 0, instanceOids: [a()] }]);

      expect(
        await route(scenario.tenantWebhook, [{ matchers: [{ user_id: 'U1', team_id: 'T1' }] }])
      ).toEqual([{ event: 0, instanceOids: [a()] }]);
    });

    it('requires every value to be equal, with no extras on either side', async () => {
      expect(
        await route(scenario.tenantWebhook, [{ matchers: [{ team_id: 'T1', user_id: 'U9' }] }])
      ).toEqual([]);
      expect(
        await route(scenario.tenantWebhook, [{ matchers: [{ team_id: 'T1', extra: 'x' }] }])
      ).toEqual([]);
      expect(await route(scenario.tenantWebhook, [{ matchers: [{ user_id: 'U1' }] }])).toEqual(
        []
      );
    });

    it('evaluates each stored matcher on its own', async () => {
      expect(await route(scenario.tenantWebhook, [{ matchers: [{ team_id: 'T1' }] }])).toEqual(
        [{ event: 0, instanceOids: [a()] }]
      );
    });

    it('drops events that carry no matcher', async () => {
      expect(
        await route(scenario.tenantWebhook, [
          { matchers: [] },
          { matchers: [{}] },
          { matchers: [{ a: {} }] }
        ])
      ).toEqual([]);
    });

    it('routes each event independently of the others', async () => {
      expect(
        await route(scenario.tenantWebhook, [
          { matchers: [{ team_id: 'T1', user_id: 'U1' }] },
          { matchers: [{ team_id: 'nope' }] },
          { matchers: [{ team_id: 'T1' }] }
        ])
      ).toEqual([
        { event: 0, instanceOids: [a()] },
        { event: 2, instanceOids: [a()] }
      ]);
    });

    it('unions the instances an event matches into a deduped list', async () => {
      expect(
        await route(scenario.tenantWebhook, [
          {
            matchers: [
              { team_id: 'T1', user_id: 'U1' },
              { team_id: 'T1' },
              { team_id: 'nope' }
            ]
          }
        ])
      ).toEqual([{ event: 0, instanceOids: [a()] }]);
    });

    it('only reaches instances subscribed to the registration the event arrived on', async () => {
      // Instance A stores the same matcher but is subscribed to the tenant webhook, not this one.
      expect(
        await route(scenario.globalWebhook, [{ matchers: [{ team_id: 'T1', user_id: 'U1' }] }])
      ).toEqual([{ event: 0, instanceOids: [b()] }]);
    });

    it('fans a global webhook out across tenants that identify themselves the same way', async () => {
      await link(scenario.instanceA, scenario.globalWebhook);

      expect(
        await route(scenario.globalWebhook, [{ matchers: [{ team_id: 'T1', user_id: 'U1' }] }])
      ).toEqual([{ event: 0, instanceOids: [a(), b()].sort() }]);
    });

    it('never matches automated registrations', async () => {
      await link(scenario.instanceA, scenario.automatedWebhook);

      expect(
        await route(scenario.automatedWebhook, [
          { matchers: [{ team_id: 'T1', user_id: 'U1' }] }
        ])
      ).toEqual([]);
    });

    it('excludes deleted trigger registrations', async () => {
      await testDb.triggerRegistration.update({
        where: { oid: scenario.instanceA.triggerRegistrationOid },
        data: { status: 'deleted' }
      });

      expect(
        await route(scenario.tenantWebhook, [{ matchers: [{ team_id: 'T1', user_id: 'U1' }] }])
      ).toEqual([]);
    });
  });
});
