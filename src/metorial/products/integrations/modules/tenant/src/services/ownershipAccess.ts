import { Service } from '@lowerdeck/service';
import {
  getOwnershipAccessorForFacing,
  invalidateOwnershipAccessorForFacing,
  type OwnershipFacing
} from '../lib/ownershipAccess';

class ownershipAccessServiceImpl {
  async getOwnershipAccess(d: OwnershipFacing) {
    let accessor = await getOwnershipAccessorForFacing(d);

    return {
      kind: accessor.kind,
      isEnforced: accessor.isEnforced,
      isRestrictedByProject: accessor.isRestrictedByProject,
      ownActorIds: accessor.ownActorIds
    };
  }

  async invalidateOwnershipAccessor(d: OwnershipFacing) {
    await invalidateOwnershipAccessorForFacing(d);
  }
}

export let ownershipAccessService = Service.create(
  'ownershipAccessService',
  () => new ownershipAccessServiceImpl()
).build();
