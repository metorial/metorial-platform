import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';
import { bootLoader } from './boot';
import { instancesLoader } from './instance';

export let sandboxesLoader = createLoader({
  name: 'sandboxes',
  parents: [bootLoader, instancesLoader],
  fetch: (i: { organizationId: string; projectId?: string }) =>
    withAuth(sdk =>
      autoPaginate(
        cursor =>
          sdk.sandboxes.list(i.organizationId, {
            ...cursor,
            limit: 100,
            projectId: i.projectId
          }),
        (item: { id: string }) => item.id
      )
    ),
  mutators: {
    create: (
      i: {
        name: string;
        projectId: string;
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.sandboxes.create(organizationId, {
          name: i.name,
          projectId: i.projectId
        })
      ),

    update: (
      i: {
        sandboxId: string;
        name?: string;
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.sandboxes.update(organizationId, i.sandboxId, {
          name: i.name
        })
      )
  }
});

export let useSandboxes = (
  organizationId: string | null | undefined,
  opts?: {
    projectId?: string;
  }
) => {
  let sandboxes = sandboxesLoader.use(organizationId ? { organizationId, ...opts } : null);

  return {
    ...sandboxes,
    createMutator: sandboxes.useMutator('create'),
    updateMutator: sandboxes.useMutator('update')
  };
};
