import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoSkillVersion, type CargoSkillVersionSnapshot } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';
import { storeService } from './store';

type SkillVersionAccessInput = {
  owner: FileOwner;
  skillId: string;
  storeId: string;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

class SkillVersionServiceImpl {
  private async assertStoreAccess(d: SkillVersionAccessInput) {
    await storeService.getStoreById({
      owner: d.owner,
      storeId: d.storeId,
      accessActor: d.accessActor,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    });
  }

  async listSkillVersions(d: SkillVersionAccessInput) {
    await this.assertStoreAccess(d);

    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillVersion.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillId: d.skillId,
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

  async getSkillVersionById(
    d: SkillVersionAccessInput & {
      skillVersionId: string;
    }
  ) {
    await this.assertStoreAccess(d);

    let { scope } = await resolveCargoAccess(d);
    let version = await cargo.skillVersion.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillVersionId: d.skillVersionId
    });

    if (version.skillId !== d.skillId) {
      throw new ServiceError(notFoundError('skill.version', d.skillVersionId));
    }

    return version;
  }

  async getSkillVersionSnapshot(
    d: SkillVersionAccessInput & {
      skillVersionId: string;
    }
  ): Promise<CargoSkillVersionSnapshot> {
    await this.assertStoreAccess(d);

    let { scope } = await resolveCargoAccess(d);

    return await cargo.skillVersion.getSnapshot({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillId: d.skillId,
      skillVersionId: d.skillVersionId
    });
  }
}

export type { CargoSkillVersion, CargoSkillVersionSnapshot };

export let skillVersionService = Service.create(
  'fileSkillVersion',
  () => new SkillVersionServiceImpl()
).build();
