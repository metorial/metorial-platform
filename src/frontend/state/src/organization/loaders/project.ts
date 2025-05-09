import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';
import { bootLoader } from './boot';

export let projectsLoader = createLoader({
  name: 'projects',
  parents: [bootLoader],
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk =>
      autoPaginate(cursor => sdk.projects.list(i.organizationId, { limit: 100, ...cursor }))
    ),
  mutators: {
    create: (i: { name: string }, { input: { organizationId } }) =>
      withAuth(sdk => sdk.projects.create(organizationId, i))
  }
});

export let useProjects = (organizationId: string | null | undefined) => {
  let projects = projectsLoader.use(organizationId ? { organizationId } : null);

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
