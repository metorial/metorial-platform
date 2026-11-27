import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { describe, expect, it } from 'vitest';
import {
  identityActorService,
  identityDelegationConfigService,
  identityService
} from '../src';

describe('module-identity', () => {
  let org = useOrganization();

  it('creates, updates and archives a person actor with an identity', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);
    let { tenant } = await resolveMetorialFacing({ instance });
    let name = uniqueId('actor');

    let actor = await identityActorService.createIdentityActor({
      instance,
      auditScope,
      input: { name, type: 'person', metadata: { e2e: true } }
    });
    expect(actor.name).toBe(name);
    expect(actor.type).toBe('person');
    expect(actor.status).toBe('active');
    expect(actor.tenantOid).toBe(tenant.oid);

    let fetched = await identityActorService.getIdentityActorById({
      instance,
      identityActorId: actor.id
    });
    expect(fetched.id).toBe(actor.id);

    let actors = await firstPage(
      await identityActorService.listIdentityActors({ instance, ids: [actor.id] })
    );
    expect(actors.map(item => item.id)).toEqual([actor.id]);

    let identityName = uniqueId('identity');
    let identity = await identityService.createIdentity({
      instance,
      auditScope,
      actor,
      input: { name: identityName, inputs: [] }
    });
    expect(identity.name).toBe(identityName);
    expect(identity.actor.id).toBe(actor.id);
    expect(identity.credentials).toEqual([]);

    let identities = await firstPage(
      await identityService.listIdentities({ instance, actorIds: [actor.id] })
    );
    expect(identities.map(item => item.id)).toEqual([identity.id]);

    let archivedIdentity = await identityService.archiveIdentity({
      instance,
      auditScope,
      identity
    });
    expect(archivedIdentity.status).toBe('archived');

    let renamed = uniqueId('renamed');
    let updated = await identityActorService.updateIdentityActor({
      instance,
      auditScope,
      identityActor: fetched,
      input: { name: renamed }
    });
    expect(updated.name).toBe(renamed);

    let archived = await identityActorService.archiveIdentityActor({
      instance,
      auditScope,
      identityActor: updated
    });
    expect(archived.status).toBe('archived');

    expect(
      await firstPage(
        await identityActorService.listIdentityActors({ instance, ids: [actor.id] })
      )
    ).toEqual([]);
    expect(
      (
        await identityActorService.getIdentityActorById({
          instance,
          identityActorId: actor.id
        })
      ).status
    ).toBe('archived');
  });

  it('ensures a default delegation config and manages custom ones', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);

    let defaultConfig = await identityDelegationConfigService.getIdentityDelegationConfigById({
      instance,
      identityDelegationConfigId: 'default'
    });
    expect(defaultConfig.isDefault).toBe(true);
    expect(defaultConfig.currentVersion?.subDelegationBehavior).toBe('deny');
    expect(
      (
        await identityDelegationConfigService.getIdentityDelegationConfigById({
          instance,
          identityDelegationConfigId: 'default'
        })
      ).id
    ).toBe(defaultConfig.id);

    let name = uniqueId('delegation');
    let config = await identityDelegationConfigService.createIdentityDelegationConfig({
      instance,
      auditScope,
      input: { name, subDelegationBehavior: 'allow', subDelegationDepth: 2 }
    });
    expect(config.name).toBe(name);
    expect(config.isDefault).toBe(false);
    expect(config.currentVersion?.subDelegationBehavior).toBe('allow');
    expect(config.currentVersion?.subDelegationDepth).toBe(2);

    let updated = await identityDelegationConfigService.updateIdentityDelegationConfig({
      instance,
      auditScope,
      identityDelegationConfig: config,
      input: { subDelegationBehavior: 'deny' }
    });
    expect(updated.currentVersion?.subDelegationBehavior).toBe('deny');
    expect(updated.currentVersion?.subDelegationDepth).toBe(0);
    expect(updated.currentVersionOid).not.toBe(config.currentVersionOid);

    let listed = await firstPage(
      await identityDelegationConfigService.listIdentityDelegationConfigs({
        instance,
        ids: [config.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([config.id]);

    let archived = await identityDelegationConfigService.archiveIdentityDelegationConfig({
      instance,
      auditScope,
      identityDelegationConfig: updated
    });
    expect(archived.status).toBe('archived');
  });

  it('rejects invalid actors and unknown ids', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);

    await expect(
      identityActorService.createIdentityActor({
        instance,
        auditScope,
        input: { name: uniqueId('consumer'), type: 'consumer' }
      })
    ).rejects.toThrow(/consumer owner/);
    await expect(
      identityActorService.getIdentityActorById({
        instance,
        identityActorId: uniqueId('missing-actor')
      })
    ).rejects.toThrow(/could not be found/);
    await expect(
      identityService.getIdentityById({ instance, identityId: uniqueId('missing-identity') })
    ).rejects.toThrow(/could not be found/);
  });
});
