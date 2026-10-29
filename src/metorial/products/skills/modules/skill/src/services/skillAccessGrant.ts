import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Project } from '@metorial/db';
import { withTransaction } from '@metorial/db';
import {
  accessTagService,
  consumerSkillManageAccessRoles,
  isStoreResourceFlagEnabled,
  type ResourceAuthorization,
  storeAccessGrantService
} from '@metorial/module-access';
import { skillStoreResource } from '@metorial/module-store';
import type { SkillRecord } from './skill';

class SkillAccessGrantServiceImpl {
  private async assertCanManageAccess(d: {
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    useStoreAccess: boolean;
  }) {
    if (d.authorization.type == 'privileged') return;

    if (d.useStoreAccess && d.skill.store) {
      return await skillStoreResource.assertAccess({
        store: d.skill.store,
        authorization: d.authorization,
        level: 'manage'
      });
    }

    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.authorization.accessTags,
      roles: [...consumerSkillManageAccessRoles]
    });
    let manageableSkill =
      accessTagFilter &&
      (await withTransaction(
        async db =>
          await db.skill.findFirst({
            where: { oid: d.skill.oid, accessTagEntities: accessTagFilter },
            select: { oid: true }
          }),
        { ifExists: true }
      ));

    if (!manageableSkill) {
      throw new ServiceError(
        forbiddenError({ message: 'You do not have permission to view access to this skill.' })
      );
    }
  }

  async listSkillAccessGrants(d: {
    project: Project;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
  }) {
    let useStoreAccess =
      !!d.skill.store &&
      (await isStoreResourceFlagEnabled({ project: d.project, flag: 'store-access-v2' }));

    await this.assertCanManageAccess({ ...d, useStoreAccess });

    let grants =
      useStoreAccess && d.skill.store
        ? await skillStoreResource.listGrants({ store: d.skill.store })
        : await storeAccessGrantService.listLegacySkillGrants({ skillOid: d.skill.oid });

    let accessTags = await withTransaction(
      async db =>
        await db.accessTag.findMany({
          where: { oid: { in: grants.map(grant => grant.accessTagOid) } },
          include: {
            consumerGroup: { include: { personalOwner: true } },
            consumerProfile: true
          }
        }),
      { ifExists: true }
    );
    let accessTagsByOid = new Map(accessTags.map(accessTag => [accessTag.oid, accessTag]));

    return grants.flatMap(grant => {
      let accessTag = accessTagsByOid.get(grant.accessTagOid);
      return accessTag ? [{ level: grant.level, accessTag }] : [];
    });
  }
}

export let skillAccessGrantService = Service.create(
  'cargoSkillAccessGrantService',
  () => new SkillAccessGrantServiceImpl()
).build();

export type SkillAccessGrantRecord = Awaited<
  ReturnType<typeof skillAccessGrantService.listSkillAccessGrants>
>[number];
