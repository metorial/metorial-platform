import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoSkillPluginRepository } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';
import type { EnrichedCargoSkillPlugin } from './skillPlugin';

type SkillPluginRepositoryAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

export type EnrichedCargoSkillPluginRepository = CargoSkillPluginRepository;

class SkillPluginRepositoryServiceImpl {
  async listSkillPluginRepositories(
    d: SkillPluginRepositoryAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillPluginRepository.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillPluginId: d.skillPlugin.backing.id,
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

  async getSkillPluginRepositoryById(
    d: SkillPluginRepositoryAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      skillPluginRepositoryId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillPluginRepository.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      skillPluginRepositoryId: d.skillPluginRepositoryId
    });
  }

  async createSkillPluginRepository(
    d: SkillPluginRepositoryAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      repoId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillPluginRepository.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      repoId: d.repoId
    });
  }

  async deleteSkillPluginRepository(
    d: SkillPluginRepositoryAccessInput & {
      skillPlugin: EnrichedCargoSkillPlugin;
      skillPluginRepositoryId: string;
    }
  ) {
    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillPluginRepository.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillPluginId: d.skillPlugin.backing.id,
      skillPluginRepositoryId: d.skillPluginRepositoryId
    });
  }
}

export let skillPluginRepositoryService = Service.create(
  'fileSkillPluginRepository',
  () => new SkillPluginRepositoryServiceImpl()
).build();
