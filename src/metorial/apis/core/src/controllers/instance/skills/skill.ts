import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillResourceService, skillService } from '@metorial/module-skill';
import { skillGroupItemService, skillGroupService } from '@metorial/module-skill-groups';
import { skillTemplateService } from '@metorial/module-skill-templates';
import { ID } from '@metorial/db';
import { consumerSkillService } from '@metorial/module-consumer-entities';
import { skillPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';

let skillClientNameValidator = v.string({
  modifiers: [
    v.minLength(1),
    v.regex(/^(?!-)(?!.*--)[a-z0-9-]+(?<!-)$/, {
      message:
        'Must use lowercase alphanumeric characters or hyphens, cannot start or end with a hyphen, and cannot contain consecutive hyphens.'
    })
  ]
});

let skillClientDescriptionValidator = v.string({
  modifiers: [v.minLength(1)]
});

let skillLicenseValidator = v.string({
  modifiers: [v.minLength(1)]
});

let skillCompatibilityValidator = v.string({
  modifiers: [v.minLength(1)]
});

export let skillGroup = instanceGroup.use(hasFlags(['skills-enabled'])).use(async ctx => {
  if (!ctx.params.skillId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillId is required',
        description: 'The skillId path parameter is required.'
      })
    );
  }

  let access = await getInstanceCargoAccess(ctx);
  let localSkill = await skillService.getSkillById({
    project: access.project,
    instance: access.instance,
    skillId: ctx.params.skillId,
    allowDeleted: true,
    accessTags: ctx.consumerProfile ? ctx.accessTags : undefined
  });
  let skill = await skillResourceService.hydrateSkill(localSkill);

  return { skill };
});

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

export let skillController = Controller.create(
  {
    name: 'Skills',
    description:
      'Skills group provider and integration capabilities into reusable, owned compositions.'
  },
  {
    list: instanceGroup
      .get(instancePath('skills', 'skills.list'), {
        name: 'List skills',
        description: 'Returns a paginated list of skills.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill creation time'),
            updated_at: dateFilterValidator('skill last update time')
          })
        )
      )
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let paginator = await skillService.listSkills({
          project: access.project,
          instance: access.instance,
          search: ctx.query.search,
          allowDeleted: true,
          statuses: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          skillGroupIds: normalizeArrayParam(ctx.query.skill_group_id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at,
          accessTags: ctx.consumerProfile ? ctx.accessTags : undefined
        });

        let list = await paginator.run(ctx.query);
        let items = await skillResourceService.hydrateSkills(list.items, {
          instance: access.instance
        });

        return Paginator.present({ ...list, items }, skill =>
          skillPresenter.present({ skill })
        );
      }),

    get: skillGroup
      .get(instancePath('skills/:skillId', 'skills.get'), {
        name: 'Get skill',
        description: 'Retrieves a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPresenter)
      .do(async ctx => {
        if (ctx.resourceActor) {
          let access = await getInstanceCargoAccess(ctx);
          await skillService.markSkillUse({
            project: access.project,
            instance: access.instance,
            skill: ctx.skill.localSkill,
            actor: ctx.resourceActor
          });
        }
        return skillPresenter.present({ skill: ctx.skill });
      }),

    create: instanceGroup
      .post(instancePath('skills', 'skills.create'), {
        name: 'Create skill',
        description: 'Creates a new skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),

          client_name: v.optional(skillClientNameValidator),
          client_description: v.optional(skillClientDescriptionValidator),
          license: v.optional(skillLicenseValidator),
          compatibility: v.optional(skillCompatibilityValidator),
          client_metadata: v.optional(v.record(v.any())),
          image_file_id: v.optional(v.nullable(v.string())),
          template_id: v.optional(v.string()),
          skill_group_id: v.optional(v.string())
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let skillGroupId = ctx.body.skill_group_id;
        let access = await getInstanceCargoAccess(ctx);
        if (skillGroupId) {
          await skillGroupService.getSkillGroupById({
            project: access.project,
            instance: access.instance,
            skillGroupId,
            allowDeleted: true,
            accessTags: ctx.consumerProfile ? ctx.accessTags : undefined
          });
        }

        let input = {
          name: ctx.body.name,
          description: ctx.body.description,
          clientName: ctx.body.client_name,
          clientDescription: ctx.body.client_description,
          license: ctx.body.license,
          compatibility: ctx.body.compatibility,
          clientMetadata: ctx.body.client_metadata,
          metadata: ctx.body.metadata,
          imageFileId: ctx.body.image_file_id,
          templateId: ctx.body.template_id
        };

        let skill = ctx.consumerProfile
          ? await (async () => {
              let created = await consumerSkillService.createConsumerSkill({
                organization: ctx.organization,
                instance: ctx.instance,
                project: ctx.project,
                auditScope: ctx.auditScope,
                consumerSurface: ctx.consumerSurface!,
                consumerProfile: ctx.consumerProfile,
                consumerGroups: ctx.consumerGroups!,
                input
              });
              return await skillResourceService.hydrateSkill(created);
            })()
          : await (async () => {
              let template = input.templateId
                ? await skillTemplateService.getSkillTemplateById({
                    project: access.project,
                    instance: access.instance,
                    skillTemplateId: input.templateId
                  })
                : await skillTemplateService.getDefaultSkillTemplate({
                    project: access.project,
                    instance: access.instance
                  });

              let localSkill = await skillService.createSkill({
                project: access.project,
                instance: access.instance,
                auditScope: access.auditScope,
                parentSkillTemplate: template,
                input: {
                  id: await ID.generateId('skill'),
                  authorization: access.authorization,
                  name: input.name,
                  description: input.description,
                  clientName: input.clientName,
                  clientDescription: input.clientDescription,
                  license: input.license,
                  compatibility: input.compatibility,
                  clientMetadata: input.clientMetadata as any,
                  metadata: input.metadata as any,
                  imageFileId: input.imageFileId
                }
              });
              if (template) {
                await skillResourceService.copyDelegatedTemplateResourcesToSkill({
                  skillTemplate: template,
                  skill: localSkill
                });
              }

              return await skillResourceService.hydrateSkill(localSkill);
            })();

        if (skillGroupId) {
          await skillGroupItemService.createSkillGroupItem({
            project: access.project,
            instance: access.instance,
            input: { skillGroupId, skillId: skill.id }
          });
        }

        return skillPresenter.present({ skill });
      }),

    update: skillGroup
      .patch(instancePath('skills/:skillId', 'skills.update'), {
        name: 'Update skill',
        description: 'Updates a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          client_name: v.optional(skillClientNameValidator),
          client_description: v.optional(skillClientDescriptionValidator),
          license: v.optional(v.nullable(skillLicenseValidator)),
          compatibility: v.optional(v.nullable(skillCompatibilityValidator)),
          client_metadata: v.optional(v.nullable(v.record(v.any()))),
          metadata: v.optional(v.nullable(v.record(v.any()))),
          image_file_id: v.optional(v.nullable(v.string()))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let input = {
          name: ctx.body.name,
          description: ctx.body.description,
          clientName: ctx.body.client_name,
          clientDescription: ctx.body.client_description,
          license: ctx.body.license,
          compatibility: ctx.body.compatibility,
          clientMetadata: ctx.body.client_metadata,
          metadata: ctx.body.metadata,
          imageFileId: ctx.body.image_file_id
        };

        let updated = await skillService.updateSkill({
          project: access.project,
          instance: access.instance,
          auditScope: access.auditScope,
          skill: ctx.skill.localSkill,
          authorization: access.authorization,
          defaultPermissions: access.defaultPermissions,
          overridePermissions: access.overridePermissions,
          input: input as any
        });
        let skill = await skillResourceService.hydrateSkill(updated);

        return skillPresenter.present({ skill });
      }),

    delete: skillGroup
      .delete(instancePath('skills/:skillId', 'skills.delete'), {
        name: 'Delete skill',
        description: 'Archives a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);

        let archived = await skillService.archiveSkill({
          project: access.project,
          instance: access.instance,
          skill: ctx.skill.localSkill,
          authorization: access.authorization,
          defaultPermissions: access.defaultPermissions,
          overridePermissions: access.overridePermissions
        });

        let skill = await skillResourceService.hydrateSkill(archived);

        return skillPresenter.present({ skill });
      }),

    fork: skillGroup
      .post(instancePath('skills/:skillId/fork', 'skills.fork'), {
        name: 'Fork skill',
        description:
          'Forks a skill for the current consumer. Non-consumer callers duplicate the skill instead.',
        hideInDocs: true
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          client_name: v.optional(skillClientNameValidator),
          client_description: v.optional(skillClientDescriptionValidator),
          license: v.optional(skillLicenseValidator),
          compatibility: v.optional(skillCompatibilityValidator),
          client_metadata: v.optional(v.record(v.any())),
          metadata: v.optional(v.record(v.any())),
          image_file_id: v.optional(v.nullable(v.string()))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let input = {
          allowDeleted: true,
          name: ctx.body.name,
          description: ctx.body.description,
          clientName: ctx.body.client_name,
          clientDescription: ctx.body.client_description,
          license: ctx.body.license,
          compatibility: ctx.body.compatibility,
          clientMetadata: ctx.body.client_metadata,
          metadata: ctx.body.metadata,
          imageFileId: ctx.body.image_file_id
        };
        let skill = ctx.consumerProfile
          ? await (async () => {
              let forked = await consumerSkillService.forkConsumerSkill({
                organization: ctx.organization,
                instance: ctx.instance,
                project: ctx.project,
                auditScope: ctx.auditScope,
                consumerSurface: ctx.consumerSurface!,
                consumerProfile: ctx.consumerProfile,
                consumerGroups: ctx.consumerGroups!,
                parentSkillId: ctx.skill.id,
                input
              });
              return await skillResourceService.hydrateSkill(forked);
            })()
          : await (async () => {
              let access = await getInstanceCargoAccess(ctx);
              let parentSkill = await skillService.getSkillById({
                project: access.project,
                instance: access.instance,
                skillId: ctx.skill.id,
                allowDeleted: true
              });
              let duplicate = await skillService.createSkill({
                project: access.project,
                instance: access.instance,
                auditScope: access.auditScope,
                parentSkill,
                parentSkillCloneType: 'duplicate',
                input: {
                  id: await ID.generateId('skill'),
                  authorization: access.authorization,
                  ...input
                }
              });
              await skillResourceService.copyDelegatedSkillResources({
                sourceSkill: parentSkill,
                targetSkill: duplicate
              });
              return await skillResourceService.hydrateSkill(duplicate);
            })();

        return skillPresenter.present({ skill });
      }),

    publishConsumerSkill: skillGroup
      .post(instancePath('skills/:skillId/publish', 'skills.publishConsumerSkill'), {
        name: 'Publish consumer skill',
        description: 'Publishes a consumer-owned skill to the consumer groups they belong to.',
        hideInDocs: true
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['consumer#instance.skill:write'] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPresenter)
      .do(async ctx => {
        if (!ctx.consumerProfile) {
          throw new ServiceError(
            badRequestError({
              message: 'publishConsumerSkill requires a consumer profile.'
            })
          );
        }

        let published = await consumerSkillService.publishConsumerSkill({
          organization: ctx.organization,
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          consumerSurface: ctx.consumerSurface!,
          consumerProfile: ctx.consumerProfile,
          consumerGroups: ctx.consumerGroups!,
          skillId: ctx.skill.id
        });
        let skill = await skillResourceService.hydrateSkill(published);

        return skillPresenter.present({ skill });
      }),

    share: skillGroup
      .post(instancePath('skills/:skillId/shares', 'skills.share'), {
        name: 'Share skill',
        description: 'Shares a skill with consumers or organization members.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: [
            'instance.skill:write',
            'instance.skill:manage_access',
            'consumer#instance.skill:manage_access'
          ]
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          consumer_profile_ids: v.optional(v.array(v.string())),
          organization_member_ids: v.optional(v.array(v.string())),
          permission: v.enumOf(['none', 'read', 'write'])
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        await consumerSkillService.shareSkill({
          organization: ctx.organization,
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          skill: ctx.skill.localSkill,
          permission: ctx.body.permission,
          consumerProfile: ctx.consumerProfile,
          consumerGroups: ctx.consumerGroups,
          targets: {
            consumerProfileIds: ctx.body.consumer_profile_ids,
            organizationMemberIds: ctx.body.organization_member_ids
          }
        });

        let skill = await skillResourceService.hydrateSkill(ctx.skill.localSkill);

        return skillPresenter.present({ skill });
      }),

    duplicate: skillGroup
      .post(instancePath('skills/:skillId/duplicate', 'skills.duplicate'), {
        name: 'Duplicate skill',
        description: 'Duplicates a skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          client_name: v.optional(skillClientNameValidator),
          client_description: v.optional(skillClientDescriptionValidator),
          license: v.optional(skillLicenseValidator),
          compatibility: v.optional(skillCompatibilityValidator),
          client_metadata: v.optional(v.record(v.any())),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(skillPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let parentSkill = await skillService.getSkillById({
          project: access.project,
          instance: access.instance,
          skillId: ctx.skill.id,
          allowDeleted: true
        });
        let localSkill = await skillService.createSkill({
          project: access.project,
          instance: access.instance,
          auditScope: access.auditScope,
          parentSkill,
          parentSkillCloneType: 'duplicate',
          input: {
            id: await ID.generateId('skill'),
            authorization: access.authorization,
            name: ctx.body.name,
            description: ctx.body.description,
            clientName: ctx.body.client_name,
            clientDescription: ctx.body.client_description,
            license: ctx.body.license,
            compatibility: ctx.body.compatibility,
            clientMetadata: ctx.body.client_metadata,
            metadata: ctx.body.metadata
          }
        });
        await skillResourceService.copyDelegatedSkillResources({
          sourceSkill: parentSkill,
          targetSkill: localSkill
        });
        let skill = await skillResourceService.hydrateSkill(localSkill);

        return skillPresenter.present({ skill });
      })
  }
);
