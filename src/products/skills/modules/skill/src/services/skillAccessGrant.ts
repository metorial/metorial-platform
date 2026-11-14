import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Project, SkillGroup } from '@metorial/db';
import { withTransaction } from '@metorial/db';
import {
  type ResourceAuthorization,
  skillStoreResourceAccess,
  storeResourceAccessLevels,
  type StoreResourceAccessLevel
} from '@metorial/module-access';
import { skillStoreResource } from '@metorial/module-store';
import type { SkillRecord } from './skill';

let getHighestLevel = (roles: string[]) =>
  [...storeResourceAccessLevels]
    .reverse()
    .find(level =>
      skillStoreResourceAccess.policies[level].roles.some(role => roles.includes(role))
    );

class SkillAccessGrantServiceImpl {
  private async listInheritedGrants(d: { skill: SkillRecord }) {
    return await withTransaction(
      async db => {
        let items = await db.skillGroupItem.findMany({
          where: { skillOid: d.skill.oid, status: 'active', skillGroup: { status: 'active' } },
          include: { skillGroup: true }
        });
        if (!items.length) return [];

        let entities = await db.accessTagEntity.findMany({
          where: { skillGroupOid: { in: items.map(item => item.skillGroupOid) } },
          select: {
            accessTagOid: true,
            skillGroupOid: true,
            accessTagPolicy: { select: { roles: true } }
          }
        });

        let grants = new Map<
          string,
          { accessTagOid: bigint; skillGroup: SkillGroup; roles: string[] }
        >();
        for (let entity of entities) {
          let skillGroup = items.find(
            item => item.skillGroupOid == entity.skillGroupOid
          )?.skillGroup;
          if (!skillGroup) continue;

          let key = `${skillGroup.oid}:${entity.accessTagOid}`;
          let grant = grants.get(key) ?? {
            accessTagOid: entity.accessTagOid,
            skillGroup,
            roles: []
          };
          grant.roles.push(...entity.accessTagPolicy.roles);
          grants.set(key, grant);
        }

        return [...grants.values()].flatMap(grant => {
          let level = getHighestLevel(grant.roles);
          return level
            ? [{ accessTagOid: grant.accessTagOid, level, skillGroup: grant.skillGroup }]
            : [];
        });
      },
      { ifExists: true }
    );
  }

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

    let grants: {
      accessTagOid: bigint;
      level: StoreResourceAccessLevel;
      skillGroup: SkillGroup | null;
    }[] = [
      ...(await skillStoreResource.listGrants({ store })).map(grant => ({
        ...grant,
        skillGroup: null
      })),
      ...(await this.listInheritedGrants({ skill: d.skill }))
    ];

    let accessTags = await withTransaction(
      async db =>
        await db.accessTag.findMany({
          where: { oid: { in: [...new Set(grants.map(grant => grant.accessTagOid))] } },
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
      return accessTag
        ? [{ level: grant.level, accessTag, inheritedFrom: grant.skillGroup }]
        : [];
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
