import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';
import { bootLoader } from './boot';

export let instancesLoader = createLoader({
  name: 'instances',
  parents: [bootLoader],
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk =>
      autoPaginate(cursor => sdk.instances.list(i.organizationId, { ...cursor, limit: 100 }))
    ),
  mutators: {
    create: (
      i: {
        name: string;
        type: 'development' | 'production';
        projectId: string;
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.instances.create(organizationId, {
          name: i.name,
          type: i.type,
          projectId: i.projectId
        })
      )
  }
});

export let useInstances = (
  organizationId: string | null | undefined,
  opts?: {
    projectId?: string;
  }
) => {
  let instances = instancesLoader.use(organizationId ? { organizationId, ...opts } : null);

  return {
    ...instances,
    createMutator: instances.useMutator('create')
  };
};

export let instanceLoader = createLoader({
  name: 'instance',
  parents: [instancesLoader, bootLoader],
  fetch: (i: { organizationId: string; instanceId: string }) =>
    withAuth(sdk => sdk.instances.get(i.organizationId, i.instanceId)),
  mutators: {
    update: (
      i: {
        name?: string;
      },
      { output: { id, organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.instances.update(organizationId, id, {
          name: i.name
        })
      ),

    delete: (_, { output: { id, organizationId } }) =>
      withAuth(sdk => sdk.instances.delete(organizationId, id))
  }
});

export let useInstance = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined
) => {
  let instance = instanceLoader.use(
    instanceId && organizationId ? { instanceId, organizationId } : null
  );

  return {
    ...instance,
    updateMutator: instance.useMutator('update'),
    deleteMutator: instance.useMutator('delete')
  };
};
