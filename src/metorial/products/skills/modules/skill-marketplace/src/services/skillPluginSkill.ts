import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import type { Instance, Prisma, Project, SkillPluginSkillStatus } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations,
  resolveSkillPluginSkills,
  resolveSkills
} from '@metorial/list-utils';
import { skillService } from '@metorial/module-skill';
import { skillConfigurationService } from '@metorial/module-skill-configurations';
import {
  assertSkillMarketplaceSkillLimit,
  assertSkillPluginSkillLimit,
  CargoSkillLimitError,
  toCargoSkillLimitServiceError
} from '../lib/limits';
import {
  assertConsumerCanAttachSkillToPlugin,
  assertSkillPluginWriteAccess,
  type SkillMarketplaceAccessInput
} from '../lib/skillMarketplaceAccess';
import { enqueueSkillPluginSkillLifecycle } from '../queues/lifecycle';
import type { SkillPluginRecord } from './skillPlugin';
import { assertPluginIsNotManaged, skillPluginInclude } from './skillPlugin';

let skillInclude = {
  store: true,
  parentSkill: {
    select: {
      id: true
    }
  },
  parentSkillTemplate: {
    select: {
      id: true
    }
  }
} satisfies Prisma.SkillInclude;

export let skillPluginSkillInclude = {
  skillConfiguration: {
    select: {
      id: true
    }
  },
  skillPlugin: {
    include: skillPluginInclude
  },
  skill: {
    include: skillInclude
  }
} satisfies Prisma.SkillPluginSkillInclude;

export type SkillPluginSkillRecord = Prisma.SkillPluginSkillGetPayload<{
  include: typeof skillPluginSkillInclude;
}>;

export type SkillPluginSkillStatusFilter = SkillPluginSkillStatus;

type SkillPluginSkillInput = {
  clientName?: string | null;
  clientDescription?: string | null;
  clientMetadata?: Prisma.InputJsonValue | null;
  license?: string | null;
  compatibility?: string | null;
  skillConfigurationId?: string | null;
};

let getPluginSkillSlug = createSlugGenerator(
  async (slug, d: { skillPluginId: string }) =>
    !(await db.skillPluginSkill.findFirst({
      where: {
        skillPlugin: {
          id: d.skillPluginId
        },
        pluginSkillSlug: slug
      }
    }))
);

class SkillPluginSkillServiceImpl {
  private hasUpdate(input: SkillPluginSkillInput) {
    return (
      input.clientName !== undefined ||
      input.clientDescription !== undefined ||
      input.clientMetadata !== undefined ||
      input.license !== undefined ||
      input.compatibility !== undefined ||
      input.skillConfigurationId !== undefined
    );
  }

  private async getSkillPluginSkillRecord(d: {
    project: Project;
    instance: Instance;
    skillPluginSkillId: string;
    skillPlugin?: SkillPluginRecord;
  }) {
    return await withTransaction(
      async db => {
        let skillPluginSkill = await db.skillPluginSkill.findFirst({
          where: {
            id: d.skillPluginSkillId,
            skillPluginOid: d.skillPlugin?.oid,
            skillPlugin: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid
            },
            skill: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid
            }
          },
          include: skillPluginSkillInclude
        });

        if (!skillPluginSkill) {
          throw new ServiceError(notFoundError('skill.plugin.skill', d.skillPluginSkillId));
        }

        return skillPluginSkill;
      },
      { ifExists: true }
    );
  }

  async listSkillPluginSkills(d: {
    project: Project;
    instance: Instance;
    skillPlugin: SkillPluginRecord;
    ids?: string[];
    skillIds?: string[];
    skillConfigurationIds?: string[];
    statuses?: SkillPluginSkillStatusFilter[];
    pluginSkillSlug?: string;
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let skillPluginSkills = await resolveSkillPluginSkills(d, d.ids);
    let skills = await resolveSkills(d, d.skillIds);
    let skillConfigurations = await resolveSkillConfigurations(d, d.skillConfigurationIds);
    let statuses: SkillPluginSkillStatus[] = d.statuses?.length ? d.statuses : ['active'];

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillPluginSkill.findMany({
            ...opts,
            where: {
              skillPluginOid: d.skillPlugin.oid,
              skill: {
                projectOid: d.project.oid,
                instanceOid: d.instance.oid
              },
              AND: [
                skillPluginSkills ? { oid: skillPluginSkills.in } : undefined!,
                skills ? { skillOid: skills.in } : undefined!,
                skillConfigurations
                  ? { skillConfigurationOid: skillConfigurations.in }
                  : undefined!,
                { status: { in: statuses } },
                d.pluginSkillSlug ? { pluginSkillSlug: d.pluginSkillSlug } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillPluginSkillInclude
          })
      )
    );
  }

  async getSkillPluginSkillById(d: {
    project: Project;
    instance: Instance;
    skillPluginSkillId: string;
    skillPlugin?: SkillPluginRecord;
  }) {
    return await this.getSkillPluginSkillRecord(d);
  }

  async addSkillPluginSkill(d: {
    project: Project;
    instance: Instance;
    skillPlugin: SkillPluginRecord;
    accessTags?: SkillMarketplaceAccessInput['accessTags'];
    input: {
      skillId: string;
      pluginSkillSlug?: string;
    } & SkillPluginSkillInput;
  }) {
    assertPluginIsNotManaged(d.skillPlugin);
    await assertSkillPluginWriteAccess({
      skillPlugin: d.skillPlugin,
      accessTags: d.accessTags
    });

    let skill = await skillService.getSkillById({
      project: d.project,
      instance: d.instance,
      skillId: d.input.skillId
    });
    if (d.accessTags) {
      await assertConsumerCanAttachSkillToPlugin({
        skill,
        skillPlugin: d.skillPlugin,
        accessTags: d.accessTags
      });
    }
    let existingSkillPluginSkill = await db.skillPluginSkill.findFirst({
      where: {
        skillPluginOid: d.skillPlugin.oid,
        skillOid: skill.oid
      },
      select: {
        pluginSkillSlug: true
      }
    });
    let pluginSkillSlug = await getPluginSkillSlug(
      {
        input: d.input.pluginSkillSlug ?? skill.clientName ?? skill.name ?? skill.id,
        current: existingSkillPluginSkill?.pluginSkillSlug
      },
      { skillPluginId: d.skillPlugin.id }
    );
    let skillConfigurationOid =
      d.input.skillConfigurationId === undefined
        ? undefined
        : d.input.skillConfigurationId === null
          ? null
          : (
              await skillConfigurationService.getSkillConfigurationById({
                project: d.project,
                instance: d.instance,
                skillConfigurationId: d.input.skillConfigurationId
              })
            ).oid;

    return await withTransaction(async db => {
      let matches = await db.skillPluginSkill.findMany({
        where: {
          skillPluginOid: d.skillPlugin.oid,
          OR: [{ skillOid: skill.oid }, { pluginSkillSlug }]
        },
        include: skillPluginSkillInclude
      });
      if (new Set(matches.map(m => m.oid.toString())).size > 1) {
        throw new ServiceError(
          badRequestError({
            message: 'Plugin skill slug is already in use'
          })
        );
      }

      let skillPluginSkill = matches[0];
      let lifecycleEvent: 'created' | 'updated' = 'updated';
      let activatesSkillLink = !skillPluginSkill || skillPluginSkill.status !== 'active';
      let activeSkillDelta = activatesSkillLink && skill.status === 'active' ? 1 : 0;

      if (activeSkillDelta > 0) {
        try {
          await assertSkillPluginSkillLimit({
            skillPluginOid: d.skillPlugin.oid,
            additionalCount: activeSkillDelta
          });

          let marketplacePlugins = await db.skillMarketplacePlugin.findMany({
            where: {
              skillPluginOid: d.skillPlugin.oid,
              status: 'active',
              skillMarketplace: {
                status: 'active'
              }
            },
            select: {
              skillMarketplaceOid: true
            }
          });

          for (let marketplacePlugin of marketplacePlugins) {
            await assertSkillMarketplaceSkillLimit({
              skillMarketplaceOid: marketplacePlugin.skillMarketplaceOid,
              additionalCount: activeSkillDelta
            });
          }
        } catch (error) {
          if (error instanceof CargoSkillLimitError) {
            throw toCargoSkillLimitServiceError(error);
          }

          throw error;
        }
      }

      if (skillPluginSkill) {
        if (skillPluginSkill.pluginSkillSlug !== pluginSkillSlug) {
          throw new ServiceError(
            badRequestError({
              message: 'Plugin skill slug cannot be changed'
            })
          );
        }

        skillPluginSkill = await db.skillPluginSkill.update({
          where: {
            id: skillPluginSkill.id
          },
          data: {
            status: 'active',
            skillOid: skill.oid,
            clientName: d.input.clientName,
            clientDescription: d.input.clientDescription,
            clientMetadata: d.input.clientMetadata as any,
            license: d.input.license,
            compatibility: d.input.compatibility,
            skillConfigurationOid
          },
          include: skillPluginSkillInclude
        });
      } else {
        lifecycleEvent = 'created';
        skillPluginSkill = await db.skillPluginSkill.create({
          data: {
            id: await ID.generateId('skillPluginSkill'),
            status: 'active',
            pluginSkillSlug,
            clientName: d.input.clientName,
            clientDescription: d.input.clientDescription,
            clientMetadata: d.input.clientMetadata as any,
            license: d.input.license,
            compatibility: d.input.compatibility,
            skillConfigurationOid,
            skillOid: skill.oid,
            skillPluginOid: d.skillPlugin.oid
          },
          include: skillPluginSkillInclude
        });
      }

      await enqueueSkillPluginSkillLifecycle({
        skillPluginSkillId: skillPluginSkill.id,
        event: lifecycleEvent
      });

      return skillPluginSkill;
    });
  }

  async updateSkillPluginSkill(d: {
    project: Project;
    instance: Instance;
    skillPluginSkill: SkillPluginSkillRecord;
    accessTags?: SkillMarketplaceAccessInput['accessTags'];
    input: SkillPluginSkillInput;
  }) {
    assertPluginIsNotManaged(d.skillPluginSkill.skillPlugin);
    await assertSkillPluginWriteAccess({
      skillPlugin: d.skillPluginSkill.skillPlugin,
      accessTags: d.accessTags
    });

    if (!this.hasUpdate(d.input)) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one plugin skill field must be updated'
        })
      );
    }

    let skillConfigurationOid =
      d.input.skillConfigurationId === undefined
        ? undefined
        : d.input.skillConfigurationId === null
          ? null
          : (
              await skillConfigurationService.getSkillConfigurationById({
                project: d.project,
                instance: d.instance,
                skillConfigurationId: d.input.skillConfigurationId
              })
            ).oid;

    let skillPluginSkill = await db.skillPluginSkill.update({
      where: {
        id: d.skillPluginSkill.id
      },
      data: {
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        clientMetadata: d.input.clientMetadata as any,
        license: d.input.license,
        compatibility: d.input.compatibility,
        skillConfigurationOid
      },
      include: skillPluginSkillInclude
    });

    await enqueueSkillPluginSkillLifecycle({
      skillPluginSkillId: d.skillPluginSkill.id,
      event: 'updated'
    });

    return skillPluginSkill;
  }

  async removeSkillPluginSkill(d: {
    project: Project;
    instance: Instance;
    skillPluginSkill: SkillPluginSkillRecord;
    accessTags?: SkillMarketplaceAccessInput['accessTags'];
  }) {
    assertPluginIsNotManaged(d.skillPluginSkill.skillPlugin);
    await assertSkillPluginWriteAccess({
      skillPlugin: d.skillPluginSkill.skillPlugin,
      accessTags: d.accessTags
    });

    let skillPluginSkill = await db.skillPluginSkill.update({
      where: {
        id: d.skillPluginSkill.id
      },
      data: {
        status: 'archived',
        clientName: null,
        clientDescription: null,
        clientMetadata: null,
        license: null,
        compatibility: null,
        skillConfigurationOid: null
      },
      include: skillPluginSkillInclude
    });

    await enqueueSkillPluginSkillLifecycle({
      skillPluginSkillId: d.skillPluginSkill.id,
      event: 'archived'
    });

    return skillPluginSkill;
  }
}

export let skillPluginSkillService = Service.create(
  'cargoSkillPluginSkillService',
  () => new SkillPluginSkillServiceImpl()
).build();
