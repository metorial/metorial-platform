import { Service } from '@lowerdeck/service';
import { db as subspaceDb } from '@metorial-subspace/db';
import { metorialDb } from '../lib/metorialDb';
import { ensureInstanceMirror, ensureProjectMirror } from '../lib/mirrorRecords';
import { deferToLegacyScopeReconciler } from '../queues/legacyScope/queues';

let shouldUpdateTenantLink = (d: {
  currentResourceTenantId: string | null;
  currentResourceTenantIdentifier: string | null;
  resourceTenantId: string;
  resourceTenantIdentifier: string;
}) =>
  d.currentResourceTenantId != d.resourceTenantId ||
  d.currentResourceTenantIdentifier != d.resourceTenantIdentifier;

let shouldUpdateEnvironmentLink = (d: {
  currentResourceGroupId: string | null;
  currentResourceGroupIdentifier: string | null;
  resourceGroupId: string;
  resourceGroupIdentifier: string;
}) =>
  d.currentResourceGroupId != d.resourceGroupId ||
  d.currentResourceGroupIdentifier != d.resourceGroupIdentifier;

let shouldUpdateActorLink = (d: {
  currentResourceActorId: string | null;
  currentResourceActorIdentifier: string | null;
  resourceActorId: string;
  resourceActorIdentifier: string;
}) =>
  d.currentResourceActorId != d.resourceActorId ||
  d.currentResourceActorIdentifier != d.resourceActorIdentifier;

let shouldUpdateOidReference = (d: { current: bigint | null; expected: bigint }) =>
  d.current !== d.expected;

class ReconcileResourceLinksServiceImpl {
  async reconcileProjectLinks(d: { projectOid: bigint }) {
    if (await deferToLegacyScopeReconciler({ projectOid: d.projectOid })) {
      return { linkedTenants: 0, linkedEnvironments: 0, deferred: true };
    }

    let project = await metorialDb.project.findUnique({
      where: {
        oid: d.projectOid
      },
      select: {
        oid: true,
        subspaceTenantId: true,
        resourceTenant: {
          select: {
            id: true,
            identifier: true
          }
        },
        instances: {
          select: {
            oid: true,
            subspaceEnvironmentId: true,
            resourceGroup: {
              select: {
                id: true,
                identifier: true
              }
            }
          }
        }
      }
    });

    if (!project?.subspaceTenantId) {
      return {
        linkedTenants: 0,
        linkedEnvironments: 0,
        deferred: false
      };
    }

    let linkedTenants = 0;
    let linkedEnvironments = 0;

    let subspaceTenant = await subspaceDb.tenant.findUnique({
      where: {
        id: project.subspaceTenantId
      },
      select: {
        oid: true,
        resourceTenantId: true,
        resourceTenantIdentifier: true,
        projectOid: true
      }
    });

    if (subspaceTenant) {
      let tenantUpdate: {
        resourceTenantId?: string;
        resourceTenantIdentifier?: string;
        projectOid?: bigint;
      } = {};

      if (
        project.resourceTenant &&
        shouldUpdateTenantLink({
          currentResourceTenantId: subspaceTenant.resourceTenantId,
          currentResourceTenantIdentifier: subspaceTenant.resourceTenantIdentifier,
          resourceTenantId: project.resourceTenant.id,
          resourceTenantIdentifier: project.resourceTenant.identifier
        })
      ) {
        tenantUpdate.resourceTenantId = project.resourceTenant.id;
        tenantUpdate.resourceTenantIdentifier = project.resourceTenant.identifier;
      }

      let mirroredProjectOid = await ensureProjectMirror({
        projectOid: project.oid,
        tenantOid: subspaceTenant.oid
      });

      if (
        mirroredProjectOid !== null &&
        shouldUpdateOidReference({
          current: subspaceTenant.projectOid,
          expected: mirroredProjectOid
        })
      ) {
        tenantUpdate.projectOid = mirroredProjectOid;
      }

      if (Object.keys(tenantUpdate).length > 0) {
        linkedTenants = (
          await subspaceDb.tenant.updateMany({
            where: {
              id: project.subspaceTenantId
            },
            data: tenantUpdate
          })
        ).count;
      }
    }

    for (let instance of project.instances) {
      if (!instance.subspaceEnvironmentId) continue;

      let subspaceEnvironment = await subspaceDb.environment.findUnique({
        where: {
          id: instance.subspaceEnvironmentId
        },
        select: {
          oid: true,
          tenantOid: true,
          resourceGroupId: true,
          resourceGroupIdentifier: true,
          instanceOid: true
        }
      });

      if (!subspaceEnvironment) continue;

      let environmentUpdate: {
        resourceGroupId?: string;
        resourceGroupIdentifier?: string;
        instanceOid?: bigint;
      } = {};

      if (
        instance.resourceGroup &&
        shouldUpdateEnvironmentLink({
          currentResourceGroupId: subspaceEnvironment.resourceGroupId,
          currentResourceGroupIdentifier: subspaceEnvironment.resourceGroupIdentifier,
          resourceGroupId: instance.resourceGroup.id,
          resourceGroupIdentifier: instance.resourceGroup.identifier
        })
      ) {
        environmentUpdate.resourceGroupId = instance.resourceGroup.id;
        environmentUpdate.resourceGroupIdentifier = instance.resourceGroup.identifier;
      }

      let mirroredInstanceOid = await ensureInstanceMirror({
        instanceOid: instance.oid,
        environmentOid: subspaceEnvironment.oid,
        tenantOid: subspaceEnvironment.tenantOid
      });

      if (
        mirroredInstanceOid !== null &&
        shouldUpdateOidReference({
          current: subspaceEnvironment.instanceOid,
          expected: mirroredInstanceOid
        })
      ) {
        environmentUpdate.instanceOid = mirroredInstanceOid;
      }

      if (Object.keys(environmentUpdate).length === 0) continue;

      linkedEnvironments += (
        await subspaceDb.environment.updateMany({
          where: {
            id: instance.subspaceEnvironmentId
          },
          data: environmentUpdate
        })
      ).count;
    }

    return {
      linkedTenants,
      linkedEnvironments,
      deferred: false
    };
  }

  async reconcileOrganizationActorLink(d: { organizationActorOid: bigint }) {
    let organizationActor = await metorialDb.organizationActor.findUnique({
      where: {
        oid: d.organizationActorOid
      },
      select: {
        subspaceActorId: true,
        resourceActors: {
          select: {
            id: true,
            identifier: true,
            resourceTenantOid: true
          }
        }
      }
    });

    if (!organizationActor?.subspaceActorId) {
      return { linkedActors: 0 };
    }

    let subspaceActor = await subspaceDb.tenantActor.findUnique({
      where: {
        id: organizationActor.subspaceActorId
      },
      include: {
        tenant: {
          select: {
            resourceTenantId: true
          }
        }
      }
    });

    if (!subspaceActor?.tenant.resourceTenantId) {
      return { linkedActors: 0 };
    }

    let resourceTenant = await metorialDb.resourceTenant.findUnique({
      where: {
        id: subspaceActor.tenant.resourceTenantId
      },
      select: {
        oid: true
      }
    });

    if (!resourceTenant) {
      return { linkedActors: 0 };
    }

    let resourceActor = organizationActor.resourceActors.find(
      actor => actor.resourceTenantOid == resourceTenant.oid
    );

    if (
      !resourceActor ||
      !shouldUpdateActorLink({
        currentResourceActorId: subspaceActor.resourceActorId,
        currentResourceActorIdentifier: subspaceActor.resourceActorIdentifier,
        resourceActorId: resourceActor.id,
        resourceActorIdentifier: resourceActor.identifier
      })
    ) {
      return { linkedActors: 0 };
    }

    return {
      linkedActors: (
        await subspaceDb.tenantActor.updateMany({
          where: {
            id: organizationActor.subspaceActorId
          },
          data: {
            resourceActorId: resourceActor.id,
            resourceActorIdentifier: resourceActor.identifier
          }
        })
      ).count
    };
  }
}

export let reconcileResourceLinksService = Service.create(
  'reconcileResourceLinksService',
  () => new ReconcileResourceLinksServiceImpl()
).build();
