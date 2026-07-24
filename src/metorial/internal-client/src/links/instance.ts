import { db } from '@metorial/db';
import { ensureSubspaceProjectTenant, ensureSynthesisProjectTenant } from './project';
import {
  getInstanceEnvironmentIdentifier,
  getInstanceServiceEnvironmentId,
  getInstanceServiceTenantId,
  getInstanceTenantIdentifier,
  loadInstanceWithProject,
  loadInstanceWithSubspaceContext,
  persistInstanceScope,
  toScope
} from './shared';
import type { InternalInstance, InternalScope } from './types';
import { upsertSubspaceEnvironment, upsertSynthesisEnvironment } from './upsert';

export let ensureSynthesisInstanceScope = async (
  instance: InternalInstance
): Promise<InternalScope> => {
  let tenantId = getInstanceServiceTenantId('synthesis', instance);
  let environmentId = getInstanceServiceEnvironmentId('synthesis', instance);
  let tenantIdentifier = getInstanceTenantIdentifier(instance);

  if (
    tenantId &&
    environmentId &&
    tenantIdentifier &&
    instance.internalEnvironmentIdentifier &&
    instance.project?.name &&
    instance.name &&
    instance.type
  ) {
    return toScope({
      tenantId,
      environmentId,
      tenantIdentifier,
      environmentIdentifier: instance.internalEnvironmentIdentifier,
      tenantName: instance.project.name,
      environmentName: instance.name,
      environmentType: instance.type
    });
  }

  let loadedInstance = await loadInstanceWithProject(instance);
  let environmentIdentifier = getInstanceEnvironmentIdentifier(loadedInstance);
  let tenant = await ensureSynthesisProjectTenant(loadedInstance.project!);

  tenantIdentifier = tenant.tenantIdentifier;
  environmentId = getInstanceServiceEnvironmentId('synthesis', loadedInstance);

  if (!environmentId) {
    environmentId = (
      await upsertSynthesisEnvironment({
        tenantId: tenant.tenantId,
        identifier: environmentIdentifier,
        name: loadedInstance.name,
        type: loadedInstance.type
      })
    ).id;
  }

  await persistInstanceScope({
    service: 'synthesis',
    instance: loadedInstance,
    tenantId: tenant.tenantId,
    tenantIdentifier,
    environmentId,
    environmentIdentifier
  });

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

export let ensureSubspaceInstanceScope = async (
  instance: InternalInstance
): Promise<InternalScope> => {
  let tenantId = getInstanceServiceTenantId('subspace', instance);
  let environmentId = getInstanceServiceEnvironmentId('subspace', instance);
  let tenantIdentifier = getInstanceTenantIdentifier(instance);

  if (
    tenantId &&
    environmentId &&
    tenantIdentifier &&
    instance.internalEnvironmentIdentifier &&
    instance.project?.name &&
    instance.name &&
    instance.type
  ) {
    return toScope({
      tenantId,
      environmentId,
      tenantIdentifier,
      environmentIdentifier: instance.internalEnvironmentIdentifier,
      tenantName: instance.project.name,
      environmentName: instance.name,
      environmentType: instance.type
    });
  }

  let loadedInstance = await loadInstanceWithSubspaceContext(instance);
  let environmentIdentifier = getInstanceEnvironmentIdentifier(loadedInstance);
  let tenant = await ensureSubspaceProjectTenant(loadedInstance.project!);

  tenantIdentifier = tenant.tenantIdentifier;
  environmentId = getInstanceServiceEnvironmentId('subspace', loadedInstance);

  if (!environmentId) {
    environmentId = (
      await upsertSubspaceEnvironment({
        tenantId: tenant.tenantId,
        identifier: environmentIdentifier,
        name: loadedInstance.name,
        type: loadedInstance.type
      })
    ).id;
  }

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
