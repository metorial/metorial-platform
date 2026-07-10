import { Service } from '@lowerdeck/service';
import { cargo, type CargoSkillForkSync } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';

type SkillForkSyncAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
};

class SkillForkSyncServiceImpl {
  async createSkillForkSync(
    d: SkillForkSyncAccessInput & {
      forkSkillId: string;
    }
  ): Promise<CargoSkillForkSync> {
    let access = await resolveCargoAccess(d);

    return await cargo.skillForkSync.create({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      actorId: access.actorId,
      forkSkillId: d.forkSkillId
    });
  }

  async getSkillForkSyncById(
    d: SkillForkSyncAccessInput & {
      skillForkSyncId: string;
    }
  ): Promise<CargoSkillForkSync> {
    let access = await resolveCargoAccess(d);

    return await cargo.skillForkSync.get({
      tenantId: access.scope.tenantId,
      environmentId: access.scope.environmentId,
      actorId: access.actorId,
      skillForkSyncId: d.skillForkSyncId
    });
  }
}

export { type CargoSkillForkSync };

export let skillForkSyncService = Service.create(
  'fileSkillForkSync',
  () => new SkillForkSyncServiceImpl()
).build();
