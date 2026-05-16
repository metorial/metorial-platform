import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoSkillMarketplaceRepository } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';
import type { EnrichedCargoSkillMarketplace } from './skillMarketplace';

type SkillMarketplaceRepositoryAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

export type EnrichedCargoSkillMarketplaceRepository = CargoSkillMarketplaceRepository;

class SkillMarketplaceRepositoryServiceImpl {
  async listSkillMarketplaceRepositories(
    d: SkillMarketplaceRepositoryAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillMarketplaceRepository.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillMarketplaceId: d.skillMarketplace.backing.id,
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

  async getSkillMarketplaceRepositoryById(
    d: SkillMarketplaceRepositoryAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      skillMarketplaceRepositoryId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillMarketplaceRepository.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id,
      skillMarketplaceRepositoryId: d.skillMarketplaceRepositoryId
    });
  }

  async createSkillMarketplaceRepository(
    d: SkillMarketplaceRepositoryAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      repoId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillMarketplaceRepository.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id,
      repoId: d.repoId
    });
  }

  async deleteSkillMarketplaceRepository(
    d: SkillMarketplaceRepositoryAccessInput & {
      skillMarketplace: EnrichedCargoSkillMarketplace;
      skillMarketplaceRepositoryId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillMarketplaceRepository.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillMarketplaceId: d.skillMarketplace.backing.id,
      skillMarketplaceRepositoryId: d.skillMarketplaceRepositoryId
    });
  }
}

export let skillMarketplaceRepositoryService = Service.create(
  'fileSkillMarketplaceRepository',
  () => new SkillMarketplaceRepositoryServiceImpl()
).build();
