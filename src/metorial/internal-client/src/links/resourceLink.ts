import { db, ID, type Consumer, type OrganizationActor } from '@metorial/db';
import {
  getInstanceEnvironmentIdentifier,
  getOrganizationActorIdentifier,
  getProjectTenantIdentifier,
  loadConsumer,
  loadInstanceWithSubspaceContext,
  loadOrganizationActor,
  loadProjectWithInstances
} from './shared';
import type { InternalInstance, InternalProject } from './types';

export let resolveProjectResourceTenant = async (project: InternalProject) => {
  let loadedProject = await loadProjectWithInstances(project);

  if (loadedProject.resourceTenantOid) {
    return await db.resourceTenant.findUniqueOrThrow({
      where: {
        oid: loadedProject.resourceTenantOid
      }
    });
  }

  let identifier = getProjectTenantIdentifier(loadedProject);
  let resourceTenant = await db.resourceTenant.upsert({
    where: {
      identifier
    },
    update: {
      name: loadedProject.name
    },
    create: {
      id: await ID.generateId('resourceTenant'),
      identifier,
      name: loadedProject.name
    }
  });

  await db.project.update({
    where: {
      id: loadedProject.id
    },
    data: {
      resourceTenantOid: resourceTenant.oid
    }
  });

  return resourceTenant;
};

export let resolveInstanceResourceGroup = async (instance: InternalInstance) => {
  let loadedInstance = await loadInstanceWithSubspaceContext(instance);
  let resourceTenant = await resolveProjectResourceTenant(loadedInstance.project!);

  if (loadedInstance.resourceGroupOid) {
    return await db.resourceGroup.findUniqueOrThrow({
      where: {
        oid: loadedInstance.resourceGroupOid
      }
    });
  }

  let identifier = getInstanceEnvironmentIdentifier(loadedInstance);
  let resourceGroup = await db.resourceGroup.upsert({
    where: {
      resourceTenantOid_identifier: {
        resourceTenantOid: resourceTenant.oid,
        identifier
      }
    },
    update: {
      name: loadedInstance.name,
      type: loadedInstance.type
    },
    create: {
      id: await ID.generateId('resourceGroup'),
      resourceTenantOid: resourceTenant.oid,
      identifier,
      name: loadedInstance.name,
      type: loadedInstance.type
    }
  });

  await db.instance.update({
    where: {
      id: loadedInstance.id
    },
    data: {
      resourceTenantOid: resourceTenant.oid,
      resourceGroupOid: resourceGroup.oid
    }
  });

  return resourceGroup;
};

let getProjectResourceTenantOidForSubspaceTenant = async (tenantId: string) => {
  let project = await db.project.findFirst({
    where: {
      subspaceTenantId: tenantId
    },
    select: {
      resourceTenantOid: true
    }
  });

  if (!project?.resourceTenantOid) {
    throw new Error(`No Metorial project is linked to subspace tenant ${tenantId}`);
  }

  return project.resourceTenantOid;
};

export let resolveOrganizationActorResourceActor = async (d: {
  tenantId: string;
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>;
}) => {
  let loadedOrganizationActor = await loadOrganizationActor(d.organizationActor);
  let resourceTenantOid = await getProjectResourceTenantOidForSubspaceTenant(d.tenantId);

  let resourceActor = await db.resourceActor.findFirst({
    where: {
      organizationActorOid: loadedOrganizationActor.oid,
      resourceTenantOid
    }
  });

  if (resourceActor) return resourceActor;

  return await db.resourceActor.create({
    data: {
      id: await ID.generateId('resourceActor'),
      resourceTenantOid,
      identifier: getOrganizationActorIdentifier(loadedOrganizationActor),
      name: loadedOrganizationActor.name,
      type: 'external',
      organizationActorOid: loadedOrganizationActor.oid
    }
  });
};

export let resolveConsumerResourceActor = async (d: {
  tenantId: string;
  consumer: Pick<Consumer, 'id'> & Partial<Consumer>;
}) => {
  let loadedConsumer = await loadConsumer(d.consumer);
  let resourceTenantOid = await getProjectResourceTenantOidForSubspaceTenant(d.tenantId);

  let resourceActor = await db.resourceActor.findFirst({
    where: {
      consumerOid: loadedConsumer.oid,
      resourceTenantOid
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  if (!resourceActor) {
    throw new Error(
      `No Metorial resource actor exists for consumer ${loadedConsumer.id} in subspace tenant ${d.tenantId}`
    );
  }

  return resourceActor;
};
