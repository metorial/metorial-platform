import { subspaceReferenceGroupService } from '@metorial/module-subspace-reference';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingGroupService = createSubspaceService(
  subspace.providerListingGroup,
  ['get', 'list', 'create', 'update', 'addListing', 'removeListing'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let group = await inner.create(...params);

      await subspaceReferenceGroupService
        .create({
          instance: params[0].instance,
          group: {
            id: group.id,
            name: group.name,
            slug: group.slug,
            createdAt: group.createdAt
          }
        })
        .catch(err => console.error('Failed to store subspace reference:', err));

      return group;
    }
  })
);
