import { uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  actorService,
  environmentService,
  getInstanceInternalEnvironmentIdentifier,
  getProjectInternalTenantIdentifier,
  resourceCountService,
  subspaceScopeService,
  tenantService
} from '../src';

describe('module-tenant', () => {
  let org = useOrganization();

  it('provisions a stable tenant and environment for an instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let scope = await subspaceScopeService.ensureForInstance(fixture.instance);
    expect(scope.tenant.identifier).toBe(getProjectInternalTenantIdentifier(fixture.project));
    expect(scope.environment.identifier).toBe(
      getInstanceInternalEnvironmentIdentifier(fixture.instance)
    );
    expect(scope.environment.tenantOid).toBe(scope.tenant.oid);
    expect(scope.environment.instanceOid).toBe(fixture.instance.oid);

    let again = await subspaceScopeService.ensureForInstanceUncached(fixture.instance);
    expect(again.tenant.id).toBe(scope.tenant.id);
    expect(again.environment.id).toBe(scope.environment.id);

    let instance = await db.instance.findUniqueOrThrow({ where: { id: org.ids.instanceId } });
    expect(instance.subspaceTenantId).toBe(scope.tenant.id);
    expect(instance.subspaceEnvironmentId).toBe(scope.environment.id);

    let organization = await db.organization.findUniqueOrThrow({
      where: { id: org.ids.organizationId }
    });
    expect(organization.subspaceTenantIds).toContain(scope.tenant.id);

    expect((await tenantService.getTenantById({ id: scope.tenant.identifier })).id).toBe(
      scope.tenant.id
    );
    let resolved = await tenantService.getTenantAndEnvironmentById({
      tenantId: scope.tenant.id,
      environmentId: scope.environment.identifier
    });
    expect(resolved.environment.id).toBe(scope.environment.id);
    expect(
      (
        await environmentService.getEnvironmentById({
          tenant: scope.tenant,
          id: scope.environment.id
        })
      ).identifier
    ).toBe(scope.environment.identifier);

    let counts = await resourceCountService.getResourceCounts({
      instance: fixture.instance,
      resource: ['provider_deployments', 'identity_actors']
    });
    expect(counts.resources.map(item => item.resource).sort()).toEqual([
      'identity_actors',
      'provider_deployments'
    ]);
    for (let item of counts.resources) expect(item.count).toBeGreaterThanOrEqual(0);
  });

  it('mirrors organization actors as tenant actors', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { tenant } = await subspaceScopeService.ensureForInstance(fixture.instance);

    let actor = await subspaceScopeService.ensureForOrganizationActor({
      tenant,
      organizationActor: fixture.actor
    });
    expect(actor.tenantOid).toBe(tenant.oid);
    expect(actor.type).toBe('external');

    let again = await subspaceScopeService.ensureForOrganizationActor({
      tenant,
      organizationActor: fixture.actor
    });
    expect(again.id).toBe(actor.id);
    expect((await actorService.getActorById({ tenant, id: actor.id })).id).toBe(actor.id);

    let organizationActor = await db.organizationActor.findUniqueOrThrow({
      where: { id: fixture.actor.id }
    });
    expect(organizationActor.subspaceActorId).toBe(actor.id);

    let system = await actorService.getSystemActor({ tenant });
    expect(system.type).toBe('system');
    expect((await actorService.getSystemActor({ tenant })).id).toBe(system.id);
  });

  it('rejects unknown tenants, environments and actors', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { tenant } = await subspaceScopeService.ensureForInstance(fixture.instance);

    await expect(tenantService.getTenantById({ id: uniqueId('tenant') })).rejects.toThrow();
    await expect(
      environmentService.getEnvironmentById({ tenant, id: uniqueId('environment') })
    ).rejects.toThrow();
    await expect(
      actorService.getActorById({ tenant, id: uniqueId('actor') })
    ).rejects.toThrow();
  });
});
