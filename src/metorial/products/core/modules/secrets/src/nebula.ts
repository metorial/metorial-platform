import { db, type Prisma, type Project } from '@metorial/db';
import { createRawNebulaClient } from '@metorial-platform-systems/nebula-client';
import { env } from './env';

export let nebula = createRawNebulaClient({
  endpoint: env.service.NEBULA_API_URL
});

export let ensureNebulaProjectTenant = async (project: Project) => {
  let tenantId = project.nebulaTenantId;
  let tenantIdentifier = project.internalTenantIdentifier;

  if (tenantId && tenantIdentifier) {
    return { tenantId, tenantIdentifier, project };
  }

  tenantIdentifier ??= `mte-pro-${project.oid}`;

  let tenant = await nebula.tenant.upsert({
    identifier: tenantIdentifier,
    name: project.name
  });

  let update: Prisma.ProjectUpdateInput = {
    ...(project.internalTenantIdentifier
      ? {}
      : { internalTenantIdentifier: tenantIdentifier }),
    ...(project.nebulaTenantId ? {} : { nebulaTenantId: tenant.id })
  };

  let updatedProject = await db.project.update({
    where: { id: project.id },
    data: update
  });

  return {
    tenantId: tenant.id,
    tenantIdentifier,
    project: updatedProject
  };
};

export let getTenantForNebula = async (project: Project) => {
  let {
    tenantId,
    tenantIdentifier,
    project: updatedProject
  } = await ensureNebulaProjectTenant(project);

  let tenant = await nebula.tenant.get({ tenantId });

  return {
    id: tenantId,
    identifier: tenantIdentifier,
    defaultKeyProviderId: tenant.defaultKeyProviderId ?? null,
    project: updatedProject
  };
};
