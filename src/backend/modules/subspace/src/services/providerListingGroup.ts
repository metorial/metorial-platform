import { Fabric } from '@metorial/fabric';
import { createSubspaceService, toEventBase } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingGroupService = createSubspaceService(
  subspace.providerListingGroup,
  ['get', 'list', 'create', 'update', 'delete', 'addProvider', 'removeProvider'],
  inner => ({
    create: async (...params: Parameters<typeof inner.create>) => {
      let eventBase = toEventBase(params[0]);
      await Fabric.fire('provider.provider_listing_group.created:before', eventBase);

      let providerGroup = await inner.create(...params);

      await Fabric.fire('provider.provider_listing_group.created:after', {
        ...eventBase,
        providerGroup
      });

      return providerGroup;
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let eventBase = toEventBase(params[0]);
      let providerGroup = await inner.get(params[0]);

      await Fabric.fire('provider.provider_listing_group.deleted:before', eventBase);

      await inner.delete(...params);

      await Fabric.fire('provider.provider_listing_group.deleted:after', {
        ...eventBase,
        providerGroup
      });

      return providerGroup;
    }
  })
);

export type SubspaceProviderListingGroup = Awaited<
  ReturnType<typeof subspace.providerListingGroup.get>
>;
