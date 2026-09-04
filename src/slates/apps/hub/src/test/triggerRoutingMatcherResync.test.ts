import { beforeEach, describe, expect, it } from 'vitest';
import type {
  SlateAuthConfig,
  SlateTriggerGroup,
  Tenant,
  TriggerRegistrationInstance
} from '../../prisma/generated/client';
import { getId } from '../id';
import { triggerRoutingMatcherServiceInternal } from '../internal/triggerRoutingMatcherServiceInternal';
import { resyncRoutingMatchers } from '../queues/trigger/routingMatcherResync';
import { fixtures } from './fixtures';
import { cleanDatabase, testDb } from './setup';

describe('resyncRoutingMatchers', () => {
  let f = fixtures(testDb);

  let scenario: {
    tenant: Tenant;
    authConfig: SlateAuthConfig;
    webhookGroup: SlateTriggerGroup;
    webhookInstance: TriggerRegistrationInstance;
    pollingInstance: TriggerRegistrationInstance;
  };

  let storedMatchers = (instance: TriggerRegistrationInstance) =>
    testDb.triggerRegistrationInstanceRoutingMatcher
      .findMany({
        where: { triggerRegistrationInstanceOid: instance.oid },
        select: { matcher: { select: { values: true, tenantOid: true } } }
      })
      .then(rows => rows.map(row => row.matcher));

  beforeEach(async () => {
    await cleanDatabase();

    let slate = await f.slate.complete();
    let specification = slate.currentVersion.specification;
    let tenant = await f.tenant.default();

    let makeTriggerGroup = (key: string, invocation: Record<string, any>) =>
      testDb.slateTriggerGroup.create({
        data: {
          ...getId('slateTriggerGroup'),
          identifier: `tg-${crypto.randomUUID()}`,
          hash: 'hash',
          key,
          name: key,
          spec: { id: key, name: key, invocation } as any,
          slateOid: slate.oid,
          mostRecentSpecificationOid: specification.oid
        }
      });

    let webhookGroup = await makeTriggerGroup('messages', {
      type: 'webhook',
      registration: { mode: 'manual' }
    });
    let pollingGroup = await makeTriggerGroup('digests', {
      type: 'polling',
      intervalSeconds: 600
    });

    let authMethod = await f.slateAuthMethod.default({
      slateOid: slate.oid,
      specificationOid: specification.oid
    });
    let authConfig = await f.slateAuthConfig.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      authMethodOid: authMethod.oid
    });

    let configSchema = await f.slateConfigSchema.default({
      slateOid: slate.oid,
      specificationOid: specification.oid
    });
    let slateInstance = await testDb.slateInstance.create({
      data: { ...getId('slateInstance'), slateOid: slate.oid, tenantOid: tenant.oid }
    });
    let instanceConfig = await f.slateInstanceConfig.default({
      instanceOid: slateInstance.oid,
      schemaOid: configSchema.oid,
      tenantOid: tenant.oid
    });

    let registration = await testDb.triggerRegistration.create({
      data: {
        ...getId('triggerRegistration'),
        tenantOid: tenant.oid,
        slateOid: slate.oid,
        instanceOid: slateInstance.oid,
        instanceConfigOid: instanceConfig.oid,
        authConfigOid: authConfig.oid
      }
    });

    let makeRegistrationInstance = (triggerGroup: SlateTriggerGroup) =>
      testDb.triggerRegistrationInstance.create({
        data: {
          ...getId('triggerRegistrationInstance'),
          triggerRegistrationOid: registration.oid,
          triggerGroupOid: triggerGroup.oid
        }
      });

    scenario = {
      tenant,
      authConfig,
      webhookGroup,
      webhookInstance: await makeRegistrationInstance(webhookGroup),
      pollingInstance: await makeRegistrationInstance(pollingGroup)
    };

    // What the provider named when this registration was set up.
    for (let instance of [scenario.webhookInstance, scenario.pollingInstance]) {
      await triggerRoutingMatcherServiceInternal.setInstanceMatchers({
        tenantOid: tenant.oid,
        triggerGroupOid: instance.triggerGroupOid,
        triggerRegistrationInstanceOid: instance.oid,
        matchers: [{ team_id: 'T1' }]
      });
    }
  });

  let setStoredRoutingMatchers = (matchers: Record<string, any>[]) =>
    testDb.slateAuthConfig.update({
      where: { oid: scenario.authConfig.oid },
      data: { routingMatchers: matchers }
    });

  it('moves an instance onto the identity the provider reports now', async () => {
    await setStoredRoutingMatchers([{ team_id: 'T2' }]);

    await resyncRoutingMatchers({ authConfigId: scenario.authConfig.id });

    expect(await storedMatchers(scenario.webhookInstance)).toEqual([
      { values: { team_id: 'T2' }, tenantOid: scenario.tenant.oid }
    ]);
  });

  it('leaves instances that do not route on a manual webhook alone', async () => {
    await setStoredRoutingMatchers([{ team_id: 'T2' }]);

    await resyncRoutingMatchers({ authConfigId: scenario.authConfig.id });

    expect(await storedMatchers(scenario.pollingInstance)).toEqual([
      { values: { team_id: 'T1' }, tenantOid: scenario.tenant.oid }
    ]);
  });

  it('keeps the identity it has when the provider names nothing', async () => {
    await setStoredRoutingMatchers([{ team_id: null }]);

    await resyncRoutingMatchers({ authConfigId: scenario.authConfig.id });

    expect(await storedMatchers(scenario.webhookInstance)).toEqual([
      { values: { team_id: 'T1' }, tenantOid: scenario.tenant.oid }
    ]);
  });

  it('leaves deleted trigger registrations alone', async () => {
    await setStoredRoutingMatchers([{ team_id: 'T2' }]);
    await testDb.triggerRegistration.update({
      where: { oid: scenario.webhookInstance.triggerRegistrationOid },
      data: { status: 'deleted' }
    });

    await resyncRoutingMatchers({ authConfigId: scenario.authConfig.id });

    expect(await storedMatchers(scenario.webhookInstance)).toEqual([
      { values: { team_id: 'T1' }, tenantOid: scenario.tenant.oid }
    ]);
  });
});
