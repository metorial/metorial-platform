import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerProviderTemplateReadRoles } from '@metorial/module-access';
import { providerTemplateService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerTemplatePresenter } from '../../presenters';

let providerTemplateCreateBodyValidator = v.intersection([
  v.object({
    name: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.record(v.any()))
  }),
  v.union([
    v.object({
      provider_deployment_id: v.string()
    }),
    v.object({
      provider_deployment: v.object({
        provider_id: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        locked_provider_version_id: v.optional(v.string())
      })
    })
  ])
]);

let providerTemplateGroup = instanceGroup.use(async ctx => {
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
      'Provider templates are reusable, consumer-facing wrappers around provider deployments.',
    hideInDocs: true
  },
  {
    list: instanceGroup
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
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            search: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await providerTemplateService.listProviderTemplates({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
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
        description: 'Retrieves a specific provider template.'
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

    create: instanceGroup
      .post(instancePath('provider-templates', 'providerTemplates.create'), {
        name: 'Create provider template',
        description:
          'Creates a new provider template from an existing provider deployment or creates a minimal backing deployment first.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body('default', providerTemplateCreateBodyValidator)
      .output(providerTemplatePresenter)
      .do(async ctx => {
        let providerTemplate = await providerTemplateService.createProviderTemplate({
          organization: ctx.organization,
          instance: ctx.instance,
          input:
            'provider_deployment_id' in ctx.body
              ? {
                  name: ctx.body.name,
                  description: ctx.body.description,
                  metadata: ctx.body.metadata,
                  providerDeploymentId: ctx.body.provider_deployment_id
                }
              : {
                  name: ctx.body.name,
                  description: ctx.body.description,
                  metadata: ctx.body.metadata,
                  providerDeployment: {
                    providerId: ctx.body.provider_deployment.provider_id,
                    name: ctx.body.provider_deployment.name,
                    description: ctx.body.provider_deployment.description,
                    metadata: ctx.body.provider_deployment.metadata,
                    lockedProviderVersionId:
                      ctx.body.provider_deployment.locked_provider_version_id
                  }
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
          description: 'Updates an existing provider template.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(providerTemplatePresenter)
      .do(async ctx => {
        let providerTemplate = await providerTemplateService.updateProviderTemplate({
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
          description: 'Archives an existing provider template.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(providerTemplatePresenter)
      .do(async ctx => {
        let providerTemplate = await providerTemplateService.archiveProviderTemplate({
          providerTemplate: ctx.providerTemplate,
          instance: ctx.instance
        });

        return providerTemplatePresenter.present({
          providerTemplate
        });
      })
  }
);
