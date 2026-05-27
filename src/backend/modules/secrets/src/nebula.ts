import { ensureInternalProjectTenant, nebula as internalNebula } from '@metorial/internal-clients';
import type { Project } from '@metorial/db';

export let nebula = internalNebula;

export let getTenantForNebula = async (project: Project) => {
  let { tenantId, tenantIdentifier, project: updatedProject } =
    await ensureInternalProjectTenant({ service: 'nebula', project });

  let tenant = await nebula.tenant.get({ tenantId });

  return {
    id: tenantId,
    identifier: tenantIdentifier,
    defaultKeyProviderId: tenant.defaultKeyProviderId ?? null,
    project: updatedProject
  };
};
