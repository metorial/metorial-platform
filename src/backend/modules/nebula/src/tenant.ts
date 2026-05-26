import type { Organization, Project } from '@metorial/db';
import { db } from '@metorial/db';
import { nebula } from './nebula';

export let getNebulaTenantForProject = async (d: {
  organization: Organization;
  project: Project;
}) => {
  let tenant = await nebula.tenant.upsert({
    name: d.project.name,
    identifier: d.project.id
  });

  if (!d.project.nebulaTenantId) {
    await db.project.update({
      where: { id: d.project.id },
      data: { nebulaTenantId: tenant.id }
    });

    d.project.nebulaTenantId = tenant.id;
  }

  return {
    id: tenant.id,
    identifier: d.project.id,
    defaultKeyProviderId: tenant.defaultKeyProviderId ?? null
  };
};
