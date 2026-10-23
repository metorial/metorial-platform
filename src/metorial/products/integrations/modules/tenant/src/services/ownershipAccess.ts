import { Service } from '@lowerdeck/service';
import { getOwnershipAccessorForFacing, type OwnershipFacing } from '../lib/ownershipAccess';

class ownershipAccessServiceImpl {
  async getOwnershipAccess(d: OwnershipFacing) {
    let accessor = await getOwnershipAccessorForFacing(d);

    return {
      isRestrictedByProject: accessor.isRestrictedByProject,
      ownActorIds: accessor.ownActorIds
    };
  }
}

export let ownershipAccessService = Service.create(
  'ownershipAccessService',
  () => new ownershipAccessServiceImpl()
).build();
