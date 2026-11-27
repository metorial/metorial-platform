import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillResourceService } from '@metorial/module-skill';
import { skillTemplateService } from '@metorial/module-skill-templates';
import { ID } from '@metorial/db';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  instanceGroup,
  instanceLegacyPath,
  instancePath
} from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillTemplatePresenter } from '@metorial/presenters';

export let skillTemplateGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(async ctx => {
    if (!ctx.params.skillTemplateId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillTemplateId is required',
          description: 'The skillTemplateId path parameter is required.'
        })
      );
    }

    let access = await getInstanceCargoAccess(ctx);
    let localTemplate = await skillTemplateService.getSkillTemplateById({
      project: access.project,
      instance: access.instance,
      skillTemplateId: ctx.params.skillTemplateId,
      accessTags: ctx.consumerProfile ? ctx.accessTags : undefined
    });
    let skillTemplate = await skillResourceService.hydrateSkillTemplate(localTemplate);

    return { skillTemplate };
  });

export let skillTemplateController = Controller.create(
  {
    name: 'Skill Templates',
    description: 'A skill template is a reusable starting point for creating skills.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-templates', 'skills.templates.list'), {
        name: 'List skill templates',
        description: 'Returns a paginated list of skill templates.',
        legacyPaths: instanceLegacyPath('skill-template')
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillTemplatePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(
              v.string({
                description: 'Only return skill templates matching this search text.'
              })
            ),
            status: v.optional(
              v.union(
                [
                  v.enumOf(['active', 'archived', 'deleted']),
                  v.array(v.enumOf(['active', 'archived', 'deleted']))
                ],
                {
                  description: 'Only return skill templates with one of these statuses.'
                }
              )
            ),
            owner: v.optional(
              v.union(
                [v.enumOf(['system', 'tenant']), v.array(v.enumOf(['system', 'tenant']))],
                {
                  description: 'Only return skill templates with one of these owners.'
                }
              )
            ),
            id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill templates with these IDs.'
              })
            ),
            provider_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill templates using one of these providers.'
              })
            ),
            integration_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description:
                  'Only return skill templates using one of these integrations.'
              })
            ),
            created_at: dateFilterValidator('skill template creation time'),
            updated_at: dateFilterValidator('skill template last update time')
          })
        )
      )
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let paginator = await skillTemplateService.listSkillTemplates({
          project: access.project,
          instance: access.instance,
          search: ctx.query.search,
          statuses: normalizeArrayParam(ctx.query.status),
          owners: normalizeArrayParam(ctx.query.owner),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at,
          accessTags: ctx.consumerProfile ? ctx.accessTags : undefined
        });

        let list = await paginator.run(ctx.query);
        let items = await skillResourceService.hydrateSkillTemplates(list.items);

        return Paginator.present({ ...list, items }, skillTemplate =>
          skillTemplatePresenter.present({ skillTemplate })
        );
      }),

    get: skillTemplateGroup
      .get(instancePath('skill-templates/:skillTemplateId', 'skills.templates.get'), {
        name: 'Get skill template',
        description: 'Retrieves a skill template.',
        legacyPaths: instanceLegacyPath('skill-template/:skillTemplateId')
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(skillTemplatePresenter)
      .do(async ctx => {
        return skillTemplatePresenter.present({ skillTemplate: ctx.skillTemplate });
      }),

    create: instanceGroup
      .post(instancePath('skill-templates', 'skills.templates.create'), {
        name: 'Create skill template',
        description: 'Creates a skill template.',
        legacyPaths: instanceLegacyPath('skill-template')
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ description: 'Display name.' }),
          description: v.optional(
            v.string({ description: 'Free-text description.' })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the skill template.'
            })
          ),
          from_skill_Id: v.optional(
            v.string({
              description: 'Skill to copy content and items from, by ID.'
            })
          )
        })
      )
      .output(skillTemplatePresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let localTemplate = await skillTemplateService.createSkillTemplate({
          project: access.project,
          instance: access.instance,
          auditScope: access.auditScope,
          input: {
            id: await ID.generateId('skillTemplate'),
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata as any,
            skillId: ctx.body.from_skill_Id
          }
        });
        await skillResourceService.ensureDelegatedSkillTemplate(localTemplate);
        if (ctx.body.from_skill_Id) {
          await skillResourceService.copyDelegatedSkillResourcesToTemplate({
            skill: { id: ctx.body.from_skill_Id },
            skillTemplate: localTemplate
          });
        }
        let skillTemplate = await skillResourceService.hydrateSkillTemplate(localTemplate);

        return skillTemplatePresenter.present({ skillTemplate });
      }),

    update: skillTemplateGroup
      .patch(instancePath('skill-templates/:skillTemplateId', 'skills.templates.update'), {
        name: 'Update skill template',
        description: 'Updates a skill template. Omitted fields keep their current value.',
        legacyPaths: instanceLegacyPath('skill-template/:skillTemplateId')
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string(), { description: 'Display name.' }),
          description: v.optional(v.nullable(v.string()), {
            description: 'Free-text description. `null` clears it.'
          }),
          metadata: v.optional(v.nullable(v.record(v.any())), {
            description:
              'Custom data to identify or organize the skill template. Replaces existing metadata. `null` clears it.'
          })
        })
      )
      .output(skillTemplatePresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let localTemplate = await skillTemplateService.updateSkillTemplate({
          project: access.project,
          instance: access.instance,
          auditScope: access.auditScope,
          skillTemplateId: ctx.skillTemplate.id,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata as any
          }
        });
        await skillResourceService.ensureDelegatedSkillTemplate(localTemplate);
        let skillTemplate = await skillResourceService.hydrateSkillTemplate(localTemplate);

        return skillTemplatePresenter.present({ skillTemplate });
      }),

    delete: skillTemplateGroup
      .delete(instancePath('skill-templates/:skillTemplateId', 'skills.templates.delete'), {
        name: 'Archive skill template',
        description: 'Archives a skill template.',
        legacyPaths: instanceLegacyPath('skill-template/:skillTemplateId')
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .output(skillTemplatePresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let localTemplate = await skillTemplateService.deleteSkillTemplate({
          project: access.project,
          instance: access.instance,
          auditScope: access.auditScope,
          skillTemplateId: ctx.skillTemplate.id
        });
        await skillResourceService.ensureDelegatedSkillTemplate(localTemplate);
        let skillTemplate = await skillResourceService.hydrateSkillTemplate(localTemplate);

        return skillTemplatePresenter.present({ skillTemplate });
      })
  }
);
