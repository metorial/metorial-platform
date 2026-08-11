import { db as subspaceDb } from '@metorial-subspace/db';
import { Service } from '@lowerdeck/service';
import { metorialDb } from '../lib/metorialDb';

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

class ReconcileResourceLinksServiceImpl {
  async reconcileProjectLinks(d: { projectOid: bigint }) {
    let project = await metorialDb.project.findUnique({
      where: {
        oid: d.projectOid
      },
      select: {
        subspaceTenantId: true,
        resourceTenant: {
          select: {
            id: true,
            identifier: true
          }
        },
        instances: {
          select: {
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

    if (!project?.subspaceTenantId || !project.resourceTenant) {
      return {
        linkedTenants: 0,
        linkedEnvironments: 0
      };
    }

    let linkedTenants = 0;
    let linkedEnvironments = 0;

    let subspaceTenant = await subspaceDb.tenant.findUnique({
      where: {
        id: project.subspaceTenantId
      },
      select: {
        resourceTenantId: true,
        resourceTenantIdentifier: true
      }
    });

    if (
      subspaceTenant &&
      shouldUpdateTenantLink({
        currentResourceTenantId: subspaceTenant.resourceTenantId,
        currentResourceTenantIdentifier: subspaceTenant.resourceTenantIdentifier,
        resourceTenantId: project.resourceTenant.id,
        resourceTenantIdentifier: project.resourceTenant.identifier
      })
    ) {
      linkedTenants = (
        await subspaceDb.tenant.updateMany({
          where: {
            id: project.subspaceTenantId
          },
          data: {
            resourceTenantId: project.resourceTenant.id,
            resourceTenantIdentifier: project.resourceTenant.identifier
          }
        })
      ).count;
    }

    for (let instance of project.instances) {
      if (!instance.subspaceEnvironmentId || !instance.resourceGroup) continue;

      let subspaceEnvironment = await subspaceDb.environment.findUnique({
        where: {
          id: instance.subspaceEnvironmentId
        },
        select: {
          resourceGroupId: true,
          resourceGroupIdentifier: true
        }
      });

      if (
        !subspaceEnvironment ||
        !shouldUpdateEnvironmentLink({
          currentResourceGroupId: subspaceEnvironment.resourceGroupId,
          currentResourceGroupIdentifier: subspaceEnvironment.resourceGroupIdentifier,
          resourceGroupId: instance.resourceGroup.id,
          resourceGroupIdentifier: instance.resourceGroup.identifier
        })
      ) {
        continue;
      }

      linkedEnvironments += (
        await subspaceDb.environment.updateMany({
          where: {
            id: instance.subspaceEnvironmentId
          },
          data: {
            resourceGroupId: instance.resourceGroup.id,
            resourceGroupIdentifier: instance.resourceGroup.identifier
          }
        })
      ).count;
    }

    return {
      linkedTenants,
      linkedEnvironments
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

  async reconcileConsumerActorLink(d: { consumerOid: bigint }) {
    let consumer = await metorialDb.consumer.findUnique({
      where: {
        oid: d.consumerOid
      },
      select: {
        subspaceActorId: true
      }
    });

    if (!consumer?.subspaceActorId) {
      return { linkedActors: 0 };
    }

    let subspaceActor = await subspaceDb.tenantActor.findUnique({
      where: {
        id: consumer.subspaceActorId
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

    let resourceActor = await metorialDb.resourceActor.findFirst({
      where: {
        consumerOid: d.consumerOid,
        resourceTenantOid: resourceTenant.oid
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        id: true,
        identifier: true
      }
    });

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
            id: consumer.subspaceActorId
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
