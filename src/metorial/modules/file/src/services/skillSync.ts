import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoSkillSync } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';

type SkillSyncAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

export type EnrichedCargoSkillSync = CargoSkillSync;

class SkillSyncServiceImpl {
  async listSkillSyncs(
    d: SkillSyncAccessInput & {
      ids?: string[];
      skillMarketplaceIds?: string[];
      skillPluginIds?: string[];
      statuses?: Array<'pending' | 'completed' | 'failed' | 'processing' | 'canceled'>;
      createdAt?: any;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillSync.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillSyncIds: d.ids,
        skillMarketplaceIds: d.skillMarketplaceIds,
        skillPluginIds: d.skillPluginIds,
        statuses: d.statuses,
        createdAt: d.createdAt,
        ...input
      });

      return {
        items: result.items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillSyncById(
    d: SkillSyncAccessInput & {
      skillSyncId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillSync.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillSyncId: d.skillSyncId
    });
  }
}

export let skillSyncService = Service.create(
  'fileSkillSync',
  () => new SkillSyncServiceImpl()
).build();
