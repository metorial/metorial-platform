import { db, type Instance, type OrganizationActor, type Project } from '@metorial/db';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';

export let getSolution = () => subspaceScopeService.getSolution();

export let getTenantForSubspace = async (instance: Instance) => {
  let scope = await subspaceScopeService.ensureForInstance(instance);

  return {
    tenant: {
      id: scope.tenant.id,
      identifier: scope.tenantIdentifier
    },
    solution: scope.solution,
    environmentId: scope.environment.id,
    environmentIdentifier: scope.environmentIdentifier
  };
};

export let getActorForSubspace = async (
  tenant: { id: string; identifier: string },
  organizationActor: Pick<OrganizationActor, 'id'>
) => {
  let tenantEntity = await tenantService.getTenantById({ id: tenant.id });

  return await subspaceScopeService.ensureForOrganizationActor({
    tenant: tenantEntity,
    organizationActor
  });
};

export let syncSubspaceTenantForProject = async (
  project: Project,
  opts?: {
    internalTenantIdentifier?: string | null;
    subspaceTenantIdentifier?: string | null;
    await?: boolean;
  }
) => {
  let nextInternalTenantIdentifier =
    opts?.internalTenantIdentifier ?? opts?.subspaceTenantIdentifier;

  if (
    nextInternalTenantIdentifier &&
    project.internalTenantIdentifier !== nextInternalTenantIdentifier
  ) {
    project = await db.project.update({
      where: {
        id: project.id
      },
      data: {
        internalTenantIdentifier: nextInternalTenantIdentifier
      }
    });
  }

  let { tenant, tenantIdentifier } = await subspaceScopeService.ensureForProject(project);
  let instances = await db.instance.findMany({
    where: {
      projectOid: project.oid
    },
    select: {
      id: true
    }
  });

  let syncInstances = Promise.all(
    instances.map(instance => subspaceScopeService.ensureForInstance(instance))
  );

  if (opts?.await) {
    await syncInstances;
  } else {
    syncInstances.catch(error => {
      console.log('Failed to sync subspace environments for project', error);
    });
  }

  return {
    id: tenant.id,
    identifier: tenantIdentifier
  };
};

// Legacy RPC client export — domain RPC controllers are removed. Wrappers that still
// import this will fail at runtime until callers cut over to @metorial-subspace/module-*.
export let subspace = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      throw new Error(
        `Subspace RPC client method "${String(prop)}" is no longer available. Call @metorial-subspace/module-* services directly.`
      );
    }
  }
) as any;
