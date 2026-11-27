import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerProviderTemplateReadRoles } from '@metorial/module-access';
import { providerTemplateService } from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerTemplatePresenter } from '@metorial/presenters';

let providerTemplateCreateBodyValidator = v.object({
  name: v.string({
    description: 'Display name for the provider template.'
  }),
  description: v.optional(
    v.string({
      description: 'Free-text description.'
    })
  ),
  metadata: v.optional(
    v.record(v.any(), {
      description: 'Custom data to identify or organize the provider template.'
    })
  ),
  integration_id: v.string({
    description: 'Integration the template is created from.',
    examples: ['int_2bCdEfGhJkLmNpQr']
  })
});

let providerTemplateGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.providerTemplateId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerTemplateId is required',
        description: 'The providerTemplateId path parameter is required.'
      })
    );
  }

  let providerTemplate = await providerTemplateService.getProviderTemplateById({
    instance: ctx.instance,
    providerTemplateId: ctx.params.providerTemplateId,
    accessTags: ctx.accessTags
  });

  return { providerTemplate };
});

export let providerTemplateController = Controller.create(
  {
    name: 'Provider Templates',
    description:
      'A provider template is a consumer-facing view of an integration. It is created from an existing integration.'
  },
  {
    list: integrationsGroup
      .get(instancePath('provider-templates', 'providerTemplates.list'), {
        name: 'List provider templates',
        description: 'Returns a paginated list of provider templates.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.deployment:read',
            ...consumerProviderTemplateReadRoles
          ]
        })
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(providerTemplatePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return provider templates with one of these IDs.'
            }),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return provider templates for one of these integrations.'
            }),
            search: v.optional(v.string(), {
              description: 'Search provider templates by name or description.'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description:
                  'Only return provider templates with one of these statuses. `deleted` templates are never listed.'
              }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await providerTemplateService.listProviderTemplates({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          search: ctx.query.search,
          status: normalizeArrayParam(ctx.query.status),
          accessTags: ctx.accessTags
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerTemplate =>
          providerTemplatePresenter.present({ providerTemplate })
        );
      }),

    get: providerTemplateGroup
      .get(instancePath('provider-templates/:providerTemplateId', 'providerTemplates.get'), {
        name: 'Get provider template',
        description: 'Retrieves a provider template.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.provider.deployment:read',
            ...consumerProviderTemplateReadRoles
          ]
        })
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(providerTemplatePresenter)
      .do(async ctx => {
        return providerTemplatePresenter.present({
          providerTemplate: ctx.providerTemplate
        });
      }),

    create: integrationsGroup
      .post(instancePath('provider-templates', 'providerTemplates.create'), {
        name: 'Create provider template',
        description: 'Creates a provider template from an existing integration.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body('default', providerTemplateCreateBodyValidator)
      .output(providerTemplatePresenter)
      .do(async ctx => {
        let providerTemplate = await providerTemplateService.createProviderTemplate({
          auditScope: ctx.auditScope,
          organization: ctx.organization,
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            integrationId: ctx.body.integration_id
          }
        });

        return providerTemplatePresenter.present({
          providerTemplate
        });
      }),

    update: providerTemplateGroup
      .patch(
        instancePath('provider-templates/:providerTemplateId', 'providerTemplates.update'),
        {
          name: 'Update provider template',
          description: 'Updates a provider template. Omitted fields keep their current value.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Display name for the provider template.'
            })
          ),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description:
                'Custom data to identify or organize the provider template. Replaces existing metadata.'
            })
          )
        })
      )
      .output(providerTemplatePresenter)
      .do(async ctx => {
        let providerTemplate = await providerTemplateService.updateProviderTemplate({
          auditScope: ctx.auditScope,
          providerTemplate: ctx.providerTemplate,
          instance: ctx.instance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return providerTemplatePresenter.present({
          providerTemplate
        });
      }),

    delete: providerTemplateGroup
      .delete(
        instancePath('provider-templates/:providerTemplateId', 'providerTemplates.delete'),
        {
          name: 'Archive provider template',
          description: 'Archives a provider template.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(providerTemplatePresenter)
      .do(async ctx => {
        let providerTemplate = await providerTemplateService.archiveProviderTemplate({
          auditScope: ctx.auditScope,
          providerTemplate: ctx.providerTemplate,
          instance: ctx.instance
        });

        return providerTemplatePresenter.present({
          providerTemplate
        });
      })
  }
);
