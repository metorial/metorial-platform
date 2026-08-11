import {
  getInstanceEnvironmentIdentifier,
  getProjectServiceTenantId,
  getProjectTenantIdentifier,
  loadProjectWithInstances,
  persistProjectTenantLink
} from './shared';
import type { InternalProject, InternalService } from './types';
import { resolveInstanceResourceGroup, resolveProjectResourceTenant } from './resourceLink';
import { upsertNebulaTenant, upsertSubspaceTenant } from './upsert';

let ensureProjectTenant = async (d: {
  service: InternalService;
  project: InternalProject;
}) => {
  let tenantId = getProjectServiceTenantId(d.service, d.project);
  let tenantIdentifier = d.project.internalTenantIdentifier;

  if (d.service == 'nebula' && tenantId && tenantIdentifier) {
    return {
      project: d.project,
      tenantId,
      tenantIdentifier
    };
  }

  let project = await loadProjectWithInstances(d.project);
  tenantIdentifier = getProjectTenantIdentifier(project);

  if (d.service == 'nebula') {
    let tenant = await upsertNebulaTenant({
      identifier: tenantIdentifier,
      name: project.name
    });

    return {
      project: await persistProjectTenantLink({
        service: d.service,
        project,
        tenantId: tenant.id,
        tenantIdentifier
      }),
      tenantId: tenant.id,
      tenantIdentifier
    };
  }

  let resourceTenant = await resolveProjectResourceTenant(project);
  let tenant = await upsertSubspaceTenant({
    identifier: tenantIdentifier,
    name: project.name,
    onlyAllowTrustedProviders: project.onlyAllowTrustedProviders,
    resourceTenantId: resourceTenant.id,
    resourceTenantIdentifier: resourceTenant.identifier,
    environments: await Promise.all(
      (project.instances ?? []).map(async instance => {
        let resourceGroup = await resolveInstanceResourceGroup(instance);

        return {
          identifier: getInstanceEnvironmentIdentifier(instance),
          name: instance.name,
          type: instance.type,
          resourceGroupId: resourceGroup.id,
          resourceGroupIdentifier: resourceGroup.identifier
        };
      })
    )
  });

  return {
    project: await persistProjectTenantLink({
      service: d.service,
      project,
      tenantId: tenant.id,
      tenantIdentifier
    }),
    tenantId: tenant.id,
    tenantIdentifier
  };
};

export let ensureSubspaceProjectTenant = async (project: InternalProject) =>
  await ensureProjectTenant({ service: 'subspace', project });

export let ensureNebulaProjectTenant = async (project: InternalProject) =>
  await ensureProjectTenant({ service: 'nebula', project });

export let ensureInternalProjectTenant = async (d: {
  service: InternalService;
  project: InternalProject;
}) => await ensureProjectTenant(d);
