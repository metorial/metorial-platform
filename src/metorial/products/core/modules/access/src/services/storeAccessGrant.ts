import { Service } from '@lowerdeck/service';
import { ID, withTransaction } from '@metorial/db';
import {
  getImpliedStoreResourceAccessLevels,
  skillStoreResourceAccess,
  storeResourceAccessLevels,
  type StoreResourceAccessDefinition,
  type StoreResourceAccessLevel
} from '../definitions/storeResourceAccess';

type StoreGrantStore = { oid: bigint; organizationOid: bigint };

class StoreAccessGrantServiceImpl {
  private async ensurePolicies(d: {
    organizationOid: bigint;
    access: StoreResourceAccessDefinition;
  }) {
    return await withTransaction(async db => {
      let policies = {} as Record<StoreResourceAccessLevel, { oid: bigint }>;

      for (let level of storeResourceAccessLevels) {
        let config = d.access.policies[level];

        let where = {
          organizationOid_systemIdentifier: {
            organizationOid: d.organizationOid,
            systemIdentifier: config.systemIdentifier
          }
        };

        let policy = await db.accessTagPolicy.findUnique({
          where,
          select: { oid: true, roles: true }
        });

        if (!policy) {
          await db.accessTagPolicy.createMany({
            data: [
              {
                id: await ID.generateId('accessTagPolicy'),
                name: config.name,
                systemIdentifier: config.systemIdentifier,
                organizationOid: d.organizationOid,
                roles: config.roles
              }
            ],
            skipDuplicates: true
          });

          policy = await db.accessTagPolicy.findUniqueOrThrow({
            where,
            select: { oid: true, roles: true }
          });
        }

        let rolesDrifted =
          policy.roles.length != config.roles.length ||
          config.roles.some(role => !policy.roles.includes(role));
        if (rolesDrifted) {
          await db.accessTagPolicy.update({
            where: { oid: policy.oid },
            data: { roles: config.roles }
          });
        }

        policies[level] = { oid: policy.oid };
      }

      return policies;
    });
  }

  private getLevelForRoles(d: { roles: string[]; access: StoreResourceAccessDefinition }) {
    return storeResourceAccessLevels.filter(level =>
      d.access.policies[level].roles.some(role => d.roles.includes(role))
    );
  }

  async listGrants(d: { store: StoreGrantStore; access: StoreResourceAccessDefinition }) {
    return await withTransaction(
      async db => {
        let entities = await db.accessTagEntity.findMany({
          where: {
            storeOid: d.store.oid,
            accessTagPolicy: {
              organizationOid: d.store.organizationOid,
              systemIdentifier: {
                in: storeResourceAccessLevels.map(
                  level => d.access.policies[level].systemIdentifier
                )
              }
            }
          },
          select: {
            accessTagOid: true,
            accessTagPolicy: { select: { roles: true } }
          }
        });

        return this.getHighestLevels({ entities, access: d.access });
      },
      { ifExists: true }
    );
  }

  async listLegacySkillGrants(d: { skillOid: bigint }) {
    return await withTransaction(
      async db => {
        let entities = await db.accessTagEntity.findMany({
          where: { skillOid: d.skillOid },
          select: {
            accessTagOid: true,
            accessTagPolicy: { select: { roles: true } }
          }
        });

        return this.getHighestLevels({ entities, access: skillStoreResourceAccess });
      },
      { ifExists: true }
    );
  }

  private getHighestLevels(d: {
    entities: { accessTagOid: bigint; accessTagPolicy: { roles: string[] } }[];
    access: StoreResourceAccessDefinition;
  }) {
    let levelsByTag = new Map<bigint, Set<StoreResourceAccessLevel>>();
    for (let entity of d.entities) {
      let levels = levelsByTag.get(entity.accessTagOid) ?? new Set();
      for (let level of this.getLevelForRoles({
        roles: entity.accessTagPolicy.roles,
        access: d.access
      })) {
        levels.add(level);
      }
      levelsByTag.set(entity.accessTagOid, levels);
    }

    return [...levelsByTag.entries()]
      .filter(([, levels]) => levels.size > 0)
      .map(([accessTagOid, levels]) => ({
        accessTagOid,
        level: [...storeResourceAccessLevels].reverse().find(level => levels.has(level))!
      }));
  }

  async setAccessLevel(d: {
    store: StoreGrantStore;
    access: StoreResourceAccessDefinition;
    accessTagOids: bigint[];
    level: StoreResourceAccessLevel | 'none';
  }) {
    if (!d.accessTagOids.length) return;

    await withTransaction(async db => {
      let policies = await this.ensurePolicies({
        organizationOid: d.store.organizationOid,
        access: d.access
      });

      let grantedLevels =
        d.level == 'none' ? [] : getImpliedStoreResourceAccessLevels(d.level);
      let revokedLevels = storeResourceAccessLevels.filter(
        level => !grantedLevels.includes(level)
      );

      if (revokedLevels.length) {
        await db.accessTagEntity.deleteMany({
          where: {
            storeOid: d.store.oid,
            accessTagOid: { in: d.accessTagOids },
            accessTagPolicyOid: { in: revokedLevels.map(level => policies[level].oid) }
          }
        });
      }

      if (grantedLevels.length) {
        await db.accessTagEntity.createMany({
          data: d.accessTagOids.flatMap(accessTagOid =>
            grantedLevels.map(level => ({
              accessTagOid,
              accessTagPolicyOid: policies[level].oid,
              storeOid: d.store.oid
            }))
          ),
          skipDuplicates: true
        });
      }
    });
  }

  async grantAccessLevel(d: {
    store: StoreGrantStore;
    access: StoreResourceAccessDefinition;
    accessTagOids: bigint[];
    level: StoreResourceAccessLevel;
  }) {
    if (!d.accessTagOids.length) return;

    await withTransaction(async db => {
      let policies = await this.ensurePolicies({
        organizationOid: d.store.organizationOid,
        access: d.access
      });

      await db.accessTagEntity.createMany({
        data: d.accessTagOids.flatMap(accessTagOid =>
          getImpliedStoreResourceAccessLevels(d.level).map(level => ({
            accessTagOid,
            accessTagPolicyOid: policies[level].oid,
            storeOid: d.store.oid
          }))
        ),
        skipDuplicates: true
      });
    });
  }

  async syncLegacySkillGrants(d: { skillOid: bigint }) {
    await withTransaction(async db => {
      let skill = await db.skill.findUnique({
        where: { oid: d.skillOid },
        select: {
          storeOid: true,
          organizationOid: true,
          accessTagEntities: {
            select: {
              accessTagOid: true,
              accessTagPolicy: { select: { roles: true } }
            }
          }
        }
      });
      if (!skill?.storeOid) return;

      let storeOid = skill.storeOid;
      let policies = await this.ensurePolicies({
        organizationOid: skill.organizationOid,
        access: skillStoreResourceAccess
      });

      let desired = new Map<string, { accessTagOid: bigint; accessTagPolicyOid: bigint }>();
      for (let entity of skill.accessTagEntities) {
        for (let level of this.getLevelForRoles({
          roles: entity.accessTagPolicy.roles,
          access: skillStoreResourceAccess
        })) {
          let accessTagPolicyOid = policies[level].oid;
          desired.set(`${entity.accessTagOid}:${accessTagPolicyOid}`, {
            accessTagOid: entity.accessTagOid,
            accessTagPolicyOid
          });
        }
      }

      let existing = await db.accessTagEntity.findMany({
        where: {
          storeOid,
          accessTagPolicyOid: {
            in: storeResourceAccessLevels.map(level => policies[level].oid)
          }
        },
        select: { oid: true, accessTagOid: true, accessTagPolicyOid: true }
      });
      let existingKeys = new Set(
        existing.map(entity => `${entity.accessTagOid}:${entity.accessTagPolicyOid}`)
      );

      let stale = existing.filter(
        entity => !desired.has(`${entity.accessTagOid}:${entity.accessTagPolicyOid}`)
      );
      if (stale.length) {
        await db.accessTagEntity.deleteMany({
          where: { oid: { in: stale.map(entity => entity.oid) } }
        });
      }

      let missing = [...desired.entries()]
        .filter(([key]) => !existingKeys.has(key))
        .map(([, value]) => ({ ...value, storeOid }));
      if (missing.length) {
        await db.accessTagEntity.createMany({ data: missing, skipDuplicates: true });
      }
    });
  }
}

export let storeAccessGrantService = Service.create(
  'storeAccessGrantService',
  () => new StoreAccessGrantServiceImpl()
).build();
