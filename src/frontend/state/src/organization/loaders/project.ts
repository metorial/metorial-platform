import {
  DashboardOrganizationsProjectsCreateBody,
  DashboardOrganizationsProjectsListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';
import { bootLoader } from './boot';

export let projectsLoader = createLoader({
  name: 'projects',
  parents: [bootLoader],
  fetch: (i: { organizationId: string } & DashboardOrganizationsProjectsListQuery) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.projects.list(i.organizationId, { limit: 100, ...cursor, ...i })
      )
    ),
  mutators: {
    create: (i: DashboardOrganizationsProjectsCreateBody, { input: { organizationId } }) =>
      withAuth(sdk => sdk.projects.create(organizationId, i))
  }
});

export let createProject = (
  d: DashboardOrganizationsProjectsCreateBody & { organizationId: string }
) => {
  return withAuth(sdk => sdk.projects.create(d.organizationId, d));
};

export let useProjects = (
  organizationId: string | null | undefined,
  query?: Partial<DashboardOrganizationsProjectsListQuery>
) => {
  let projects = projectsLoader.use(organizationId ? { organizationId, ...query } : null);

  return {
    ...projects,
    createMutator: projects.useMutator('create')
  };
};

export let projectLoader = createLoader({
  name: 'project',
  parents: [projectsLoader, bootLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk => sdk.projects.get(i.organizationId, i.projectId)),
  mutators: {
    update: (
      i: {
        name?: string;
        imageFileId?: string | null;
      },
      { output: { id, organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.projects.update(organizationId, id, {
          name: i.name
        })
      ),

    delete: (_, { output: { id, organizationId } }) =>
      withAuth(sdk => sdk.projects.delete(organizationId, id))
  }
});

export let useProject = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let organization = projectLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...organization,
    updateMutator: organization.useMutator('update'),
    deleteMutator: organization.useMutator('delete')
  };
};
