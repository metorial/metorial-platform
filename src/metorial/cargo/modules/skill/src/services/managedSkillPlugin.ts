import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import { getId } from '@metorial/cargo-config/id';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import type { Prisma, SkillPluginSkillStatus, SkillPluginStatus } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { createSkillDestination } from '../internal/skillDestination';
import type { LifecycleEvent } from '../queues/lifecycle/_ids';
import { enqueueSkillPluginLifecycle } from '../queues/lifecycle/skillPlugin';
import { enqueueSkillPluginSkillLifecycle } from '../queues/lifecycle/skillPluginSkill';
import { skillPluginInclude } from './skillPlugin';

let managedSkillPluginInclude = {
  skill: true,
  skillPlugin: {
    include: skillPluginInclude
  }
} satisfies Prisma.ManagedSkillPluginInclude;

export type ManagedSkillPluginRecord = Prisma.ManagedSkillPluginGetPayload<{
  include: typeof managedSkillPluginInclude;
}>;

type SkillForManagedPlugin = Prisma.SkillGetPayload<{
  include: {
    resourceTenant: true;
    resourceGroup: true;
  };
}>;

type ManagedSkillPluginValues = {
  name: string;
  description: string | null;
  slug: string;
  configHash: string;
};

class ManagedSkillPluginServiceImpl {
  private async getManagedValues(
    skill: Pick<SkillForManagedPlugin, 'id' | 'name' | 'description' | 'clientName'>
  ) {
    let name = skill.name?.trim() ? skill.name : skill.id;
    let description = skill.description ?? null;

    return {
      name,
      description,
      slug: slugify(
        `managed-${(skill.clientName ?? skill.name ?? skill.id).replaceAll('_', '-')}-${generatePlainId(12)}`.toLowerCase()
      ),
      configHash: await Hash.sha256(
        JSON.stringify({
          version: 3,
          name,
          description
        })
      )
    } satisfies ManagedSkillPluginValues;
  }

  private getCurrentManagedLink(managedSkillPlugin: ManagedSkillPluginRecord) {
    return managedSkillPlugin.skillPlugin.skillPluginSkills.find(
      skillPluginSkill =>
        skillPluginSkill.skill.oid === managedSkillPlugin.skillOid &&
        skillPluginSkill.status === 'active'
    );
  }

  private isCurrentManagedPlugin(
    managedSkillPlugin: ManagedSkillPluginRecord,
    values: ManagedSkillPluginValues
  ) {
    return (
      managedSkillPlugin.configHash === values.configHash &&
      managedSkillPlugin.skillPlugin.status === 'active' &&
      managedSkillPlugin.skillPlugin.name === values.name &&
      managedSkillPlugin.skillPlugin.description === values.description &&
      managedSkillPlugin.skillPlugin.slug === values.slug &&
      !!this.getCurrentManagedLink(managedSkillPlugin)
    );
  }

  private async getManagedSkillPluginForSkill(skillOid: bigint) {
    return await db.managedSkillPlugin.findUnique({
      where: {
        skillOid
      },
      include: managedSkillPluginInclude
    });
  }

  private async enqueuePluginLifecycle(d: {
    skillPluginId?: string;
    skillPluginSkillIds?: string[];
    pluginEvent?: LifecycleEvent;
    pluginSkillEvent?: LifecycleEvent;
  }) {
    if (d.skillPluginId && d.pluginEvent) {
      await enqueueSkillPluginLifecycle({
        skillPluginId: d.skillPluginId,
        event: d.pluginEvent
      });
    }

    for (let skillPluginSkillId of d.skillPluginSkillIds ?? []) {
      if (!d.pluginSkillEvent) continue;

      await enqueueSkillPluginSkillLifecycle({
        skillPluginSkillId,
        event: d.pluginSkillEvent
      });
    }
  }

  private async createManagedSkillPlugin(
    skill: SkillForManagedPlugin,
    values: ManagedSkillPluginValues
  ) {
    let destination = await createSkillDestination({
      resourceTenant: skill.resourceTenant!,
      purpose: 'cargo.skill.managed-plugin'
    });

    let managedSkillPlugin = await withTransaction(async db => {
      let skillPlugin = await db.skillPlugin.create({
        data: {
          ...getId('skillPlugin'),
          status: 'active' as SkillPluginStatus,
          isManaged: true,
          name: values.name,
          description: values.description,
          slug: values.slug,
          resourceTenantOid: skill.resourceTenantOid,
          resourceGroupOid: skill.resourceGroupOid,
          organizationOid: skill.organizationOid,
          instanceOid: skill.instanceOid,
          destinationOid: destination.oid
        }
      });

      await db.skillPluginSkill.create({
        data: {
          ...getId('skillPluginSkill'),
          status: 'active' as SkillPluginSkillStatus,
          pluginSkillSlug: slugify(
            (skill.clientName ?? skill.name ?? skill.id).replaceAll('_', '-')
          ),
          skillOid: skill.oid,
          skillPluginOid: skillPlugin.oid
        }
      });

      let createdOrUpdated = await db.managedSkillPlugin.upsert({
        where: {
          skillOid: skill.oid
        },
        create: {
          ...getId('managedSkillPlugin'),
          configHash: values.configHash,
          skillOid: skill.oid,
          skillPluginOid: skillPlugin.oid
        },
        update: {
          configHash: values.configHash
        }
      });

      let managedSkillPlugin = await db.managedSkillPlugin.findUnique({
        where: {
          oid: createdOrUpdated.oid
        },
        include: managedSkillPluginInclude
      });
      if (!managedSkillPlugin) {
        throw new ServiceError(notFoundError('managed.skill.plugin', createdOrUpdated.id));
      }

      return managedSkillPlugin;
    });

    await this.enqueuePluginLifecycle({
      skillPluginId: managedSkillPlugin.skillPlugin.id,
      skillPluginSkillIds: managedSkillPlugin.skillPlugin.skillPluginSkills.map(s => s.id),
      pluginEvent: 'created',
      pluginSkillEvent: 'created'
    });

    return managedSkillPlugin;
  }

  private async updateManagedSkillPlugin(
    managedSkillPlugin: ManagedSkillPluginRecord,
    values: ManagedSkillPluginValues
  ) {
    let currentLink = this.getCurrentManagedLink(managedSkillPlugin);
    let skillPluginChanged =
      managedSkillPlugin.skillPlugin.status !== 'active' ||
      managedSkillPlugin.skillPlugin.name !== values.name ||
      managedSkillPlugin.skillPlugin.description !== values.description;

    let managedConfigChanged = managedSkillPlugin.configHash !== values.configHash;

    let result = await withTransaction(async db => {
      if (skillPluginChanged) {
        await db.skillPlugin.update({
          where: {
            oid: managedSkillPlugin.skillPluginOid
          },
          data: {
            status: 'active',
            name: values.name,
            description: values.description
          },
          include: skillPluginInclude
        });
      }

      if (managedConfigChanged) {
        await db.managedSkillPlugin.update({
          where: {
            oid: managedSkillPlugin.oid
          },
          data: {
            configHash: values.configHash
          }
        });
      }

      let linkEvent: LifecycleEvent | undefined;
      let skillPluginSkillId = currentLink?.id;
      if (!skillPluginSkillId) {
        let existingSkillPluginSkill = await db.skillPluginSkill.findFirst({
          where: {
            skillPluginOid: managedSkillPlugin.skillPluginOid,
            skillOid: managedSkillPlugin.skillOid
          },
          select: {
            id: true,
            status: true
          }
        });

        if (existingSkillPluginSkill) {
          let skillPluginSkill = await db.skillPluginSkill.update({
            where: {
              id: existingSkillPluginSkill.id
            },
            data: {
              status: 'active',
              clientName: null,
              clientDescription: null,
              clientMetadata: null,
              license: null,
              compatibility: null,
              skillConfigurationOid: null
            },
            select: {
              id: true
            }
          });
          skillPluginSkillId = skillPluginSkill.id;
          linkEvent = 'updated';
        } else {
          let skillPluginSkill = await db.skillPluginSkill.create({
            data: {
              ...getId('skillPluginSkill'),
              status: 'active',
              pluginSkillSlug: slugify(
                (
                  managedSkillPlugin.skill.clientName ??
                  managedSkillPlugin.skill.name ??
                  managedSkillPlugin.skill.id
                ).replaceAll('_', '-')
              ),
              skillOid: managedSkillPlugin.skillOid,
              skillPluginOid: managedSkillPlugin.skillPluginOid
            },
            select: {
              id: true
            }
          });
          skillPluginSkillId = skillPluginSkill.id;
          linkEvent = 'created';
        }
      }

      let nextManagedSkillPlugin = await this.getManagedSkillPluginForSkill(
        managedSkillPlugin.skillOid
      );
      if (!nextManagedSkillPlugin) {
        throw new ServiceError(notFoundError('managed.skill.plugin', managedSkillPlugin.id));
      }

      return {
        managedSkillPlugin: nextManagedSkillPlugin,
        skillPluginChanged,
        skillPluginSkillId,
        linkEvent
      };
    });

    await this.enqueuePluginLifecycle({
      skillPluginId: result.managedSkillPlugin.skillPlugin.id,
      skillPluginSkillIds:
        result.linkEvent && result.skillPluginSkillId ? [result.skillPluginSkillId] : [],
      pluginEvent: result.skillPluginChanged ? 'updated' : undefined,
      pluginSkillEvent: result.linkEvent
    });

    return result.managedSkillPlugin;
  }

  async ensureManagedSkillPlugin(
    d: ResourceScope & {
      skillId: string;
    }
  ) {
    let skill = await db.skill.findFirst({
      where: {
        id: d.skillId,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        status: 'active'
      },
      include: {
        resourceTenant: true,
        resourceGroup: true
      }
    });

    if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

    return await this.ensureManagedSkillPluginForSkill(skill);
  }

  private async ensureManagedSkillPluginForSkill(skill: SkillForManagedPlugin) {
    let values = await this.getManagedValues(skill);
    let managedSkillPlugin = await this.getManagedSkillPluginForSkill(skill.oid);

    if (!managedSkillPlugin) {
      return await this.createManagedSkillPlugin(skill, values);
    }

    if (this.isCurrentManagedPlugin(managedSkillPlugin, values)) {
      return managedSkillPlugin;
    }

    return await this.updateManagedSkillPlugin(managedSkillPlugin, values);
  }

  private async archiveManagedSkillPluginForSkill(skillId: string) {
    let managedSkillPlugin = await db.managedSkillPlugin.findFirst({
      where: {
        skill: {
          id: skillId
        }
      },
      include: managedSkillPluginInclude
    });

    if (!managedSkillPlugin) return null;

    let activeSkillPluginSkillIds = managedSkillPlugin.skillPlugin.skillPluginSkills
      .filter(s => s.status === 'active')
      .map(s => s.id);
    let shouldArchivePlugin = managedSkillPlugin.skillPlugin.status !== 'archived';

    if (!shouldArchivePlugin && activeSkillPluginSkillIds.length === 0) {
      return managedSkillPlugin;
    }

    await withTransaction(async db => {
      if (activeSkillPluginSkillIds.length) {
        await db.skillPluginSkill.updateMany({
          where: {
            id: {
              in: activeSkillPluginSkillIds
            }
          },
          data: {
            status: 'archived',
            clientName: null,
            clientDescription: null,
            clientMetadata: null,
            license: null,
            compatibility: null,
            skillConfigurationOid: null
          }
        });
      }

      if (shouldArchivePlugin) {
        await db.skillPlugin.update({
          where: {
            oid: managedSkillPlugin.skillPluginOid
          },
          data: {
            status: 'archived'
          }
        });
      }
    });

    await this.enqueuePluginLifecycle({
      skillPluginId: managedSkillPlugin.skillPlugin.id,
      skillPluginSkillIds: activeSkillPluginSkillIds,
      pluginEvent: shouldArchivePlugin ? 'archived' : undefined,
      pluginSkillEvent: activeSkillPluginSkillIds.length ? 'archived' : undefined
    });

    return await this.getManagedSkillPluginForSkill(managedSkillPlugin.skillOid);
  }

  async syncManagedSkillPluginForSkill(d: { skillId: string; event: LifecycleEvent }) {
    if (d.event === 'archived') {
      return await this.archiveManagedSkillPluginForSkill(d.skillId);
    }

    let skill = await db.skill.findFirst({
      where: {
        id: d.skillId,
        status: 'active'
      },
      include: {
        resourceTenant: true,
        resourceGroup: true
      }
    });

    if (!skill) return null;

    return await this.ensureManagedSkillPluginForSkill(skill);
  }
}

export let managedSkillPluginService = Service.create(
  'cargoManagedSkillPluginService',
  () => new ManagedSkillPluginServiceImpl()
).build();
