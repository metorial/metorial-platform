import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderListingGroupService = createSubspaceService(
  subspace.providerListingGroup,
  ['get', 'list', 'create', 'update', 'delete', 'addProvider', 'removeProvider'],
  inner => ({
    update: async (arg0: Parameters<typeof inner.update>[0]) => {
      let group = await inner.update(arg0);

      let linked = await db.consumerSurfaceProviderGroup.findFirst({
        where: { providerGroupId: arg0.providerListingGroupId }
      });

      if (linked) {
        await db.consumerSurfaceProviderGroup.update({
          where: { oid: linked.oid },
          data: {
            ...(arg0.name !== undefined ? { name: arg0.name } : {}),
            ...(arg0.description !== undefined ? { description: arg0.description } : {})
          }
        });
      }

      return group;
    },
    delete: async (arg0: Parameters<typeof inner.delete>[0]) => {
      let linked = await db.consumerSurfaceProviderGroup.findFirst({
        where: { providerGroupId: arg0.providerListingGroupId }
      });

      if (linked) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete provider group linked to a consumer surface provider group'
          })
        );
      }

      return await inner.delete(arg0);
    }
  })
);

export type SubspaceProviderListingGroup = Awaited<
  ReturnType<typeof subspace.providerListingGroup.get>
>;
