import { expectOk, expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  actorService,
  environmentService,
  getInstanceInternalEnvironmentIdentifier,
  getOrganizationActorInternalActorIdentifier,
  getProjectInternalTenantIdentifier,
  metorialResourceService,
  resourceCountService,
  subspaceScopeService,
  tenantService
} from '../src';

let loadProject = (projectId: string) =>
  db.project.findUniqueOrThrow({ where: { id: projectId }, include: { instances: true } });

let loadInstance = (instanceId: string) =>
  db.instance.findUniqueOrThrow({
    where: { id: instanceId },
    include: { organization: true, project: { include: { instances: true } } }
  });

let loadOrganization = (organizationId: string) =>
  db.organization.findUniqueOrThrow({ where: { id: organizationId } });

describe('module-tenant subspace scope', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let secondProjectId: string;

  beforeAll(async () => {
    let project = expectOk(
      await org.clients.rest.post(
        `/dashboard/organizations/${org.ids.organizationId}/projects`,
        {
          name: uniqueId('E2E Second Project')
        }
      )
    );
    secondProjectId = project.id;
  });

  it('provisions one tenant per project and one environment per instance, idempotently', async () => {
    let project = await loadProject(org.ids.projectId);

    let runs = await Promise.all(
      [1, 2, 3].map(() => subspaceScopeService.ensureForProjectUncached({ id: project.id }))
    );
    let tenant = runs[0]!.tenant;
    expect(new Set(runs.map(run => run.tenant.id))).toEqual(new Set([tenant.id]));
    expect(tenant).toMatchObject({
      identifier: getProjectInternalTenantIdentifier(project),
      name: project.name,
      projectOid: project.oid,
      onlyAllowTrustedProviders: project.onlyAllowTrustedProviders
    });
    expect(await subspaceDb.tenant.count({ where: { identifier: tenant.identifier } })).toBe(
      1
    );

    let environments = await subspaceDb.environment.findMany({
      where: { tenantOid: tenant.oid }
    });
    expect(environments).toHaveLength(project.instances.length);
    for (let instance of project.instances) {
      expect(environments).toContainEqual(
        expect.objectContaining({
          identifier: getInstanceInternalEnvironmentIdentifier(instance),
          name: instance.name,
          type: instance.type,
          instanceOid: instance.oid,
          projectOid: project.oid
        })
      );
    }

    let linked = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(linked).toMatchObject({
      subspaceTenantId: tenant.id,
      internalTenantIdentifier: tenant.identifier
    });
    let resourceTenant = await db.resourceTenant.findUniqueOrThrow({
      where: { oid: linked.resourceTenantOid! }
    });
    expect(tenant.resourceTenantId).toBe(resourceTenant.id);

    expect(
      await subspaceDb.project.findUniqueOrThrow({ where: { oid: project.oid } })
    ).toMatchObject({ id: project.id, tenantOid: tenant.oid });

    let scopes = await Promise.all(
      [1, 2].map(() =>
        subspaceScopeService.ensureForInstanceUncached({ id: org.ids.instanceId })
      )
    );
    expect(new Set(scopes.map(scope => scope.environment.id)).size).toBe(1);
    expect(scopes[0]!.tenant.id).toBe(tenant.id);

    let instance = await db.instance.findUniqueOrThrow({ where: { id: org.ids.instanceId } });
    expect(instance).toMatchObject({
      subspaceTenantId: tenant.id,
      subspaceEnvironmentId: scopes[0]!.environment.id,
      internalEnvironmentIdentifier: scopes[0]!.environment.identifier
    });
    expect(
      await subspaceDb.instance.findUniqueOrThrow({ where: { oid: instance.oid } })
    ).toMatchObject({ id: instance.id, environmentOid: scopes[0]!.environment.oid });
  });

  it('gives every project of an organization its own tenant', async () => {
    let first = await subspaceScopeService.ensureForProjectUncached({ id: org.ids.projectId });
    let second = await subspaceScopeService.ensureForProjectUncached({ id: secondProjectId });
    expect(second.tenant.id).not.toBe(first.tenant.id);

    let secondProject = await loadProject(secondProjectId);
    expect(second.tenant.projectOid).toBe(secondProject.oid);

    let secondInstance = secondProject.instances[0]!;
    let scope = await subspaceScopeService.ensureForInstanceUncached({
      id: secondInstance.id
    });
    expect(scope.tenant.id).toBe(second.tenant.id);
    expect(scope.environment.tenantOid).toBe(second.tenant.oid);

    await expectServiceError(
      environmentService.getEnvironmentById({
        tenant: first.tenant,
        id: scope.environment.id
      }),
      'not_found'
    );
    await expectServiceError(
      tenantService.getTenantAndEnvironmentById({
        tenantId: first.tenant.id,
        environmentId: scope.environment.identifier
      }),
      'not_found'
    );

    let organization = await loadOrganization(org.ids.organizationId);
    expect(organization.subspaceTenantIds).toEqual(
      expect.arrayContaining([first.tenant.id, second.tenant.id])
    );
    expect(new Set(organization.subspaceTenantIds).size).toBe(
      organization.subspaceTenantIds.length
    );
  });

  it('mirrors an organization actor into each tenant of its organization separately', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { tenant: first } = await subspaceScopeService.ensureForProjectUncached({
      id: org.ids.projectId
    });
    let { tenant: second } = await subspaceScopeService.ensureForProjectUncached({
      id: secondProjectId
    });

    let firstActor = await subspaceScopeService.ensureForOrganizationActor({
      tenant: first,
      organizationActor: fixture.actor
    });
    let secondActor = await subspaceScopeService.ensureForOrganizationActor({
      tenant: second,
      organizationActor: fixture.actor
    });
    let secondAgain = await subspaceScopeService.ensureForOrganizationActor({
      tenant: second,
      organizationActor: fixture.actor
    });

    expect(secondActor.id).not.toBe(firstActor.id);
    expect(secondAgain.id).toBe(secondActor.id);
    for (let [actor, tenant] of [
      [firstActor, first],
      [secondActor, second]
    ] as const) {
      expect(actor).toMatchObject({
        tenantOid: tenant.oid,
        type: 'external',
        identifier: getOrganizationActorInternalActorIdentifier(fixture.actor),
        organizationActorOid: fixture.actor.oid
      });
    }
    expect(
      await subspaceDb.tenantActor.count({
        where: { organizationActorOid: fixture.actor.oid, tenantOid: second.oid }
      })
    ).toBe(1);

    await expectServiceError(
      actorService.getActorById({ tenant: second, id: firstActor.id }),
      'not_found'
    );
    expect(
      (await actorService.getActorById({ tenant: second, id: secondActor.identifier })).id
    ).toBe(secondActor.id);
  });

  it('keeps the scopes of two organizations apart', async () => {
    let mine = await subspaceScopeService.ensureForInstanceUncached({
      id: org.ids.instanceId
    });
    let theirs = await subspaceScopeService.ensureForInstanceUncached({
      id: otherOrg.ids.instanceId
    });
    expect(theirs.tenant.id).not.toBe(mine.tenant.id);
    expect(theirs.environment.id).not.toBe(mine.environment.id);

    await expectServiceError(
      environmentService.getEnvironmentById({
        tenant: mine.tenant,
        id: theirs.environment.id
      }),
      'not_found'
    );
    await expectServiceError(
      environmentService.getEnvironmentById({
        tenant: mine.tenant,
        id: theirs.environmentIdentifier
      }),
      'not_found'
    );
    await expectServiceError(
      tenantService.getTenantAndEnvironmentById({
        tenantId: mine.tenant.id,
        environmentId: theirs.environment.id
      }),
      'not_found'
    );

    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let theirActor = await subspaceScopeService.ensureForOrganizationActor({
      tenant: theirs.tenant,
      organizationActor: otherFixture.actor
    });
    await expectServiceError(
      actorService.getActorById({ tenant: mine.tenant, id: theirActor.id }),
      'not_found'
    );
    await expectServiceError(
      actorService.getActorById({ tenant: mine.tenant, id: theirActor.identifier }),
      'not_found'
    );

    let mySystem = await actorService.getSystemActor({ tenant: mine.tenant });
    let theirSystem = await actorService.getSystemActor({ tenant: theirs.tenant });
    expect(mySystem.id).not.toBe(theirSystem.id);
    expect((await actorService.getSystemActor({ tenant: mine.tenant })).id).toBe(mySystem.id);

    let otherOrganization = await loadOrganization(otherOrg.ids.organizationId);
    expect(otherOrganization.subspaceTenantIds).toContain(theirs.tenant.id);
    expect(otherOrganization.subspaceTenantIds).not.toContain(mine.tenant.id);
  });

  it('refuses to provision a project or instance that is linked to another scope', async () => {
    let project = await loadProject(org.ids.projectId);
    let instance = await loadInstance(org.ids.instanceId);
    let theirs = await subspaceScopeService.ensureForInstanceUncached({
      id: otherOrg.ids.instanceId
    });

    await expect(
      subspaceScopeService.ensureForProjectUncached({
        ...project,
        subspaceTenantId: theirs.tenant.id
      })
    ).rejects.toThrow(/is linked to subspace tenant/);
    await expect(
      subspaceScopeService.ensureForProjectUncached({
        ...project,
        internalTenantIdentifier: theirs.tenantIdentifier
      })
    ).rejects.toThrow(/has tenant identifier/);

    await expect(
      subspaceScopeService.ensureForInstanceUncached({
        ...instance,
        subspaceTenantId: theirs.tenant.id
      })
    ).rejects.toThrow(/is linked to subspace tenant/);
    await expect(
      subspaceScopeService.ensureForInstanceUncached({
        ...instance,
        internalTenantIdentifier: theirs.tenantIdentifier
      })
    ).rejects.toThrow(/carries tenant identifier/);
    await expect(
      subspaceScopeService.ensureForInstanceUncached({
        ...instance,
        subspaceEnvironmentId: theirs.environment.id
      })
    ).rejects.toThrow(/is linked to subspace environment/);
    await expect(
      subspaceScopeService.ensureForInstanceUncached({
        ...instance,
        internalEnvironmentIdentifier: theirs.environmentIdentifier
      })
    ).rejects.toThrow(/has environment identifier/);

    let reloaded = await db.instance.findUniqueOrThrow({ where: { id: instance.id } });
    expect(reloaded).toMatchObject({
      subspaceTenantId: instance.subspaceTenantId,
      subspaceEnvironmentId: instance.subspaceEnvironmentId
    });
    expect(
      (
        await subspaceDb.environment.findUniqueOrThrow({
          where: { id: theirs.environment.id }
        })
      ).tenantOid
    ).toBe(theirs.tenant.oid);
  });

  it('relinks a project whose tenant link points at a tenant that no longer exists', async () => {
    let { tenant } = await subspaceScopeService.ensureForProjectUncached({
      id: org.ids.projectId
    });

    await db.project.update({
      where: { id: org.ids.projectId },
      data: { subspaceTenantId: uniqueId('ktn_missing') }
    });

    let relinked = await subspaceScopeService.ensureForProjectUncached({
      id: org.ids.projectId
    });
    expect(relinked.tenant.id).toBe(tenant.id);
    expect(await subspaceDb.tenant.count({ where: { identifier: tenant.identifier } })).toBe(
      1
    );
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: org.ids.projectId } }))
        .subspaceTenantId
    ).toBe(tenant.id);
  });

  it('syncs an instance into the subspace mirrors idempotently', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let instance = await db.instance.findUniqueOrThrow({ where: { id: org.ids.instanceId } });

    await metorialResourceService.syncInstance(instance);
    await metorialResourceService.syncInstance(instance);

    let scope = await subspaceScopeService.ensureForInstanceUncached({ id: instance.id });
    expect(
      await subspaceDb.instance.findUniqueOrThrow({ where: { oid: instance.oid } })
    ).toMatchObject({ id: instance.id, environmentOid: scope.environment.oid });
    expect(
      await subspaceDb.tenantActor.count({
        where: { tenantOid: scope.tenant.oid, organizationActorOid: fixture.actor.oid }
      })
    ).toBe(1);

    let counts = await resourceCountService.getResourceCounts({
      instance: fixture.instance,
      resource: ['integration_internet_gateways', 'integration_internet_gateways']
    });
    expect(counts.resources).toEqual([
      { resource: 'integration_internet_gateways', count: 1 }
    ]);

    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let otherCounts = await resourceCountService.getResourceCounts({
      instance: otherFixture.instance,
      resource: ['integration_internet_gateways']
    });
    expect(otherCounts.resources).toEqual([
      { resource: 'integration_internet_gateways', count: 1 }
    ]);
  });
});

describe('module-tenant subspace scope cache', () => {
  let org = useOrganization();

  it(
    'returns tenant settings changed through tenantService from ensureForProject',
    async () => {
      let project = await db.project.findUniqueOrThrow({ where: { id: org.ids.projectId } });
      let { tenant } = await subspaceScopeService.ensureForProject(project);
      let timeout = tenant.messageProcessingTimeoutMs + 1_000;

      let updated = await tenantService.upsertTenant({
        input: {
          name: tenant.name,
          identifier: tenant.identifier,
          resourceTenantId: tenant.resourceTenantId!,
          resourceTenantIdentifier: tenant.resourceTenantIdentifier!,
          environments: [],
          messageProcessingTimeoutMs: timeout
        }
      });
      expect(updated.messageProcessingTimeoutMs).toBe(timeout);

      let cached = await subspaceScopeService.ensureForProject(project);
      expect(cached.tenant.messageProcessingTimeoutMs).toBe(timeout);
    }
  );
});
