import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { type AuditScope, createSystemAuditScope } from '@metorial/audit-scope';
import type { Instance, Project, Skill, SkillGroup } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { assertSkillPluginCanAddSkills, CargoSkillLimitError } from '../lib/limits';
import {
  assertSkillPluginWriteAccess,
  type SkillMarketplaceAccessInput
} from '../lib/skillMarketplaceAccess';
import { reconcileSkillGroupPluginMembership } from '../lib/skillGroupPluginMembership';
import { enqueueSkillPluginLifecycle } from '../queues/lifecycle/skillPlugin';
import { type SkillPluginRecord, skillPluginInclude, skillPluginService } from './skillPlugin';

let archiveJob = 'cargo/skill/lifecycle/skillGroupPlugin';

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
}

export let skillGroupPluginService = Service.create(
  'cargoSkillGroupPluginService',
  () => new SkillGroupPluginServiceImpl()
).build();
