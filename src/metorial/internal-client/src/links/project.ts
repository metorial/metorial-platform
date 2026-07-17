import {
  getInstanceEnvironmentIdentifier,
  getProjectServiceTenantId,
  getProjectTenantIdentifier,
  loadProjectWithInstances,
  persistProjectTenantLink
} from './shared';
import type { InternalProject, InternalService } from './types';
import { upsertNebulaTenant, upsertSubspaceTenant, upsertSynthesisTenant } from './upsert';

let ensureProjectTenant = async (d: {
  service: InternalService;
  project: InternalProject;
}) => {
  let tenantId = getProjectServiceTenantId(d.service, d.project);
  let tenantIdentifier = d.project.internalTenantIdentifier;

  if (tenantId && tenantIdentifier) {
    return {
      project: d.project,
      tenantId,
      tenantIdentifier
    };
  }

  let project = await loadProjectWithInstances(d.project);
  tenantIdentifier = getProjectTenantIdentifier(project);

  if (d.service == 'synthesis') {
    let tenant = await upsertSynthesisTenant({
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

  let tenant = await upsertSubspaceTenant({
    identifier: tenantIdentifier,
    name: project.name,
    onlyAllowTrustedProviders: project.onlyAllowTrustedProviders,
    environments: (project.instances ?? []).map(instance => ({
      identifier: getInstanceEnvironmentIdentifier(instance),
      name: instance.name,
      type: instance.type
    }))
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

export let ensureSynthesisProjectTenant = async (project: InternalProject) =>
  await ensureProjectTenant({ service: 'synthesis', project });

export let ensureSubspaceProjectTenant = async (project: InternalProject) =>
  await ensureProjectTenant({ service: 'subspace', project });

export let ensureNebulaProjectTenant = async (project: InternalProject) =>
  await ensureProjectTenant({ service: 'nebula', project });

export let ensureInternalProjectTenant = async (d: {
  service: InternalService;
  project: InternalProject;
}) => await ensureProjectTenant(d);
