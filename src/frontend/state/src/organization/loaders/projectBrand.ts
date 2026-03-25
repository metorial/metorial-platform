import type {
  DashboardOrganizationsProjectsUpdateBrandingBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let projectBrandLoader = createLoader({
  name: 'projectBrand',
  fetch: async (i: { organizationId: string; projectId: string }) =>
    await withAuth(sdk => sdk.projects.getBranding(i.organizationId, i.projectId)),
  mutators: {
    update: async (
      i: DashboardOrganizationsProjectsUpdateBrandingBody,
      { input }
    ) =>
      await withAuth(sdk =>
        sdk.projects.updateBranding(input.organizationId, input.projectId, {
          name: i.name,
          imageFileId: i.imageFileId
        })
      )
  }
});

export let useProjectBrand = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let brand = projectBrandLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...brand,
    updateMutator: brand.useMutator('update')
  };
};
