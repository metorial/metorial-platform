import { db } from '@metorial/db';
import { ensureSubspaceProjectTenant } from './project';
import {
  getInstanceEnvironmentIdentifier,
  getInstanceTenantIdentifier,
  loadInstanceWithSubspaceContext,
  persistInstanceScope,
  toScope
} from './shared';
import type { InternalInstance, InternalScope } from './types';
import { resolveInstanceResourceGroup } from './resourceLink';
import { upsertSubspaceEnvironment } from './upsert';

export let ensureSubspaceInstanceScope = async (
  instance: InternalInstance
): Promise<InternalScope> => {
  let tenantIdentifier = getInstanceTenantIdentifier(instance);

  let loadedInstance = await loadInstanceWithSubspaceContext(instance);
  let environmentIdentifier = getInstanceEnvironmentIdentifier(loadedInstance);
  let resourceGroup = await resolveInstanceResourceGroup(loadedInstance);
  let tenant = await ensureSubspaceProjectTenant(loadedInstance.project!);

  tenantIdentifier = tenant.tenantIdentifier;
  let environmentId = (
    await upsertSubspaceEnvironment({
      tenantId: tenant.tenantId,
      identifier: environmentIdentifier,
      name: loadedInstance.name,
      type: loadedInstance.type,
      resourceGroupId: resourceGroup.id,
      resourceGroupIdentifier: resourceGroup.identifier
    })
  ).id;

  await persistInstanceScope({
    service: 'subspace',
    instance: loadedInstance,
    tenantId: tenant.tenantId,
    tenantIdentifier,
    environmentId,
    environmentIdentifier
  });

  if (!loadedInstance.organization!.subspaceTenantIds.includes(tenant.tenantId)) {
    await db.organization.update({
      where: {
        id: loadedInstance.organization!.id
      },
      data: {
        subspaceTenantIds: {
          push: tenant.tenantId
        }
      }
    });
  }

  return toScope({
    tenantId: tenant.tenantId,
    environmentId,
    tenantIdentifier,
    environmentIdentifier,
    tenantName: loadedInstance.project!.name,
    environmentName: loadedInstance.name,
    environmentType: loadedInstance.type
  });
};
