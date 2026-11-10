import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Project } from '@metorial/db';
import { withTransaction } from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import { skillStoreResource } from '@metorial/module-store';
import type { SkillRecord } from './skill';

class SkillAccessGrantServiceImpl {
  async listSkillAccessGrants(d: {
    project: Project;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
  }) {
    let store = d.skill.store;
    if (!store) {
      if (d.authorization.type == 'privileged') return [];
      throw new ServiceError(
        forbiddenError({ message: 'You do not have permission to view access to this skill.' })
      );
    }

    await skillStoreResource.assertAccess({
      project: d.project,
      store,
      authorization: d.authorization,
      level: 'manage'
    });

    let grants = await skillStoreResource.listGrants({ store });

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
