import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { type AuditScope, createSystemAuditScope } from '@metorial/audit-scope';
import type { Instance, Project, Skill, SkillGroup } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { assertSkillPluginCanAddSkills, CargoSkillLimitError } from '../lib/limits';
import {
  assertSkillPluginWriteAccess,
  type SkillMarketplaceAccessInput
} from '../lib/skillMarketplaceAccess';
import {
  getSkillGroupPluginTargetSkills,
  reconcileSkillGroupPluginMembership
} from '../lib/skillGroupPluginMembership';
import { enqueueSkillPluginLifecycle } from '../queues/lifecycle/skillPlugin';
import { type SkillPluginRecord, skillPluginInclude, skillPluginService } from './skillPlugin';

let archiveJob = 'cargo/skill/lifecycle/skillGroupPlugin';
let maxSkillGroupMatches = 5;

class SkillGroupPluginServiceImpl {
  async syncSkillGroupPlugin(d: { skillGroupPluginId: string }) {
    let link = await db.skillGroupPlugin.findUnique({
      where: { id: d.skillGroupPluginId },
      include: {
        skillGroup: true,
        skillPlugin: {
          include: {
            ...skillPluginInclude,
            project: true,
            instance: true
          }
        }
      }
    });
    if (!link || link.skillPlugin.status !== 'active') return;

    if (link.skillGroup.status === 'active') {
      await reconcileSkillGroupPluginMembership({ skillGroupPluginOid: link.oid });
      return;
    }

    await skillPluginService.archiveSkillPlugin({
      project: link.skillPlugin.project,
      instance: link.skillPlugin.instance,
      skillPlugin: link.skillPlugin,
      auditScope: createSystemAuditScope({
        organization: { oid: link.skillPlugin.organizationOid },
        instance: link.skillPlugin.instance,
        job: archiveJob,
        metadata: { skillGroupId: link.skillGroup.id }
      })
    });
  }

  async assertSkillGroupCanAddSkills(d: {
    skillGroup: Pick<SkillGroup, 'oid'>;
    skills: Pick<Skill, 'oid' | 'status' | 'storeOid'>[];
  }) {
    let links = await db.skillGroupPlugin.findMany({
      where: {
        skillGroupOid: d.skillGroup.oid,
        skillPlugin: { status: 'active' }
      },
      include: {
        skillPlugin: {
          include: {
            skillPluginSkills: {
              where: { status: 'active' },
              select: { skillOid: true }
            }
          }
        }
      }
    });

    for (let link of links) {
      let linkedSkillOids = new Set(link.skillPlugin.skillPluginSkills.map(s => s.skillOid));
      let newSkills = d.skills.filter(
        skill => skill.status === 'active' && !linkedSkillOids.has(skill.oid)
      );

      try {
        await assertSkillPluginCanAddSkills({
          skillPluginOid: link.skillPluginOid,
          skills: newSkills
        });
      } catch (error) {
        if (!(error instanceof CargoSkillLimitError)) throw error;

        throw new ServiceError(
          badRequestError({
            code: 'skill_group_plugin_limit_exceeded',
            message: `This group is published as the plugin "${link.skillPlugin.name ?? link.skillPlugin.id}", which can't take these skills: ${error.message}`
          })
        );
      }
    }
  }

  async detachSkillGroupPlugin(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    skillPlugin: SkillPluginRecord;
    accessTags?: SkillMarketplaceAccessInput['accessTags'];
  }) {
    await assertSkillPluginWriteAccess({
      skillPlugin: d.skillPlugin,
      accessTags: d.accessTags
    });

    let skillGroupPlugin = d.skillPlugin.skillGroupPlugin;
    if (!skillGroupPlugin || d.skillPlugin.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          code: 'skill_plugin_not_managed_by_skill_group',
          message: 'This plugin is not synced from a skill group.'
        })
      );
    }

    return await withTransaction(async db => {
      await db.skillGroupPlugin.delete({ where: { oid: skillGroupPlugin.oid } });

      let skillPlugin = await db.skillPlugin.findUniqueOrThrow({
        where: { oid: d.skillPlugin.oid },
        include: skillPluginInclude
      });

      await Fabric.fire('skill.plugin.audit.updated:after', {
        auditScope: d.auditScope,
        skillPlugin,
        previousSkillPlugin: d.skillPlugin,
        skillGroupId: null,
        previousSkillGroupId: skillGroupPlugin.skillGroup.id
      });
      await enqueueSkillPluginLifecycle({ skillPluginId: skillPlugin.id, event: 'updated' });

      return skillPlugin;
    });
  }

  async attachSkillGroupPlugin(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    skillPlugin: SkillPluginRecord;
    skillGroupId: string;
  }) {
    await assertSkillPluginWriteAccess({ skillPlugin: d.skillPlugin });

    if (d.skillPlugin.isManaged) {
      throw new ServiceError(
        badRequestError({ message: "Managed plugins can't be synced from a skill group." })
      );
    }
    if (d.skillPlugin.status !== 'active') {
      throw new ServiceError(notFoundError('skill.plugin', d.skillPlugin.id));
    }
    if (d.skillPlugin.skillGroupPlugin) {
      throw new ServiceError(
        badRequestError({
          code: 'skill_plugin_managed_by_skill_group',
          message: `This plugin is already synced from the skill group "${d.skillPlugin.skillGroupPlugin.skillGroup.name}". Detach it first.`
        })
      );
    }

    let skillGroup = await this.getActiveSkillGroup(d);

    return await withTransaction(async db => {
      let skillGroupPlugin = await db.skillGroupPlugin.create({
        data: {
          id: await ID.generateId('skillGroupPlugin'),
          skillGroupOid: skillGroup.oid,
          skillPluginOid: d.skillPlugin.oid
        }
      });
      await reconcileSkillGroupPluginMembership({ skillGroupPluginOid: skillGroupPlugin.oid });

      let skillPlugin = await db.skillPlugin.findUniqueOrThrow({
        where: { oid: d.skillPlugin.oid },
        include: skillPluginInclude
      });

      await Fabric.fire('skill.plugin.audit.updated:after', {
        auditScope: d.auditScope,
        skillPlugin,
        previousSkillPlugin: d.skillPlugin,
        skillGroupId: skillGroup.id,
        previousSkillGroupId: null
      });
      await enqueueSkillPluginLifecycle({ skillPluginId: skillPlugin.id, event: 'updated' });

      return skillPlugin;
    });
  }

  // Compares the plugin's skills with skill groups: either the given groups, or the groups that
  // share the most skills with the plugin. Each match says what syncing from that group changes.
  async listSkillGroupMatches(d: {
    project: Project;
    instance: Instance;
    skillPlugin: SkillPluginRecord;
    skillGroupIds?: string[];
  }) {
    let pluginSkills = d.skillPlugin.skillPluginSkills.map(pluginSkill => pluginSkill.skill);
    let pluginSkillOids = new Set(pluginSkills.map(skill => skill.oid));

    let skillGroups = d.skillGroupIds
      ? await db.skillGroup.findMany({
          where: {
            id: { in: d.skillGroupIds },
            instanceOid: d.instance.oid,
            status: 'active'
          },
          take: maxSkillGroupMatches
        })
      : await this.getSkillGroupsSharingSkills({
          instance: d.instance,
          skillOids: [...pluginSkillOids]
        });

    let matches = await Promise.all(
      skillGroups.map(async skillGroup => {
        let groupSkills = await getSkillGroupPluginTargetSkills({
          skillGroupOid: skillGroup.oid
        });
        let groupSkillOids = new Set(groupSkills.map(skill => skill.oid));

        return {
          skillGroup,
          sharedSkillCount: groupSkills.filter(skill => pluginSkillOids.has(skill.oid)).length,
          skillsToAdd: groupSkills.filter(skill => !pluginSkillOids.has(skill.oid)),
          skillsToRemove: pluginSkills.filter(skill => !groupSkillOids.has(skill.oid))
        };
      })
    );

    return matches.sort(
      (a, b) =>
        b.sharedSkillCount - a.sharedSkillCount ||
        a.skillsToAdd.length +
          a.skillsToRemove.length -
          (b.skillsToAdd.length + b.skillsToRemove.length)
    );
  }

  private async getSkillGroupsSharingSkills(d: { instance: Instance; skillOids: bigint[] }) {
    if (!d.skillOids.length) return [];

    let counts = await db.skillGroupItem.groupBy({
      by: ['skillGroupOid'],
      where: {
        status: 'active',
        skillOid: { in: d.skillOids },
        skill: { status: 'active' },
        skillGroup: { instanceOid: d.instance.oid, status: 'active' }
      },
      _count: { skillOid: true },
      orderBy: { _count: { skillOid: 'desc' } },
      take: maxSkillGroupMatches
    });

    return await db.skillGroup.findMany({
      where: { oid: { in: counts.map(count => count.skillGroupOid) } }
    });
  }

  private async getActiveSkillGroup(d: { instance: Instance; skillGroupId: string }) {
    let skillGroup = await db.skillGroup.findFirst({
      where: {
        id: d.skillGroupId,
        instanceOid: d.instance.oid,
        status: 'active'
      }
    });
    if (!skillGroup) throw new ServiceError(notFoundError('skill.group', d.skillGroupId));

    return skillGroup;
  }
}

export let skillGroupPluginService = Service.create(
  'cargoSkillGroupPluginService',
  () => new SkillGroupPluginServiceImpl()
).build();
