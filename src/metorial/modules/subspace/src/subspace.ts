import {
  ensureInternalActor,
  ensureInternalProjectTenant,
  ensureInternalScope,
  getSubspaceSolution,
  subspace as internalSubspace
} from '@metorial/internal-clients';
import { db, type Instance, type OrganizationActor, type Project } from '@metorial/db';

export let subspace: typeof internalSubspace = internalSubspace;
export let getSolution = () => getSubspaceSolution();

export let getTenantForSubspace = async (instance: Instance) => {
  let [solution, scope] = await Promise.all([
    getSubspaceSolution(),
    ensureInternalScope({
      service: 'subspace',
      owner: {
        type: 'instance',
        instance
      }
    })
  ]);

  return {
    tenant: {
      id: scope.tenantId,
      identifier: scope.tenantIdentifier
    },
    solution,
    environmentId: scope.environmentId,
    environmentIdentifier: scope.environmentIdentifier
  };
};

export let getActorForSubspace = async (
  tenant: { id: string; identifier: string },
  organizationActor: Pick<OrganizationActor, 'id'>
) =>
  await ensureInternalActor({
    service: 'subspace',
    tenantId: tenant.id,
    actor: {
      type: 'organizationActor',
      organizationActor
    }
  });

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

  let { tenantId, tenantIdentifier } = await ensureInternalProjectTenant({
    service: 'subspace',
    project
  });
  let instances = await db.instance.findMany({
    where: {
      projectOid: project.oid
    },
    select: {
      id: true
    }
  });

  let syncInstances = Promise.all(
    instances.map(instance =>
      ensureInternalScope({
        service: 'subspace',
        owner: {
          type: 'instance',
          instance
        }
      })
    )
  );

  if (opts?.await) {
    await syncInstances;
  } else {
    syncInstances.catch(error => {
      console.log('Failed to sync subspace environments for project', error);
    });
  }

  return {
    id: tenantId,
    identifier: tenantIdentifier
  };
};
