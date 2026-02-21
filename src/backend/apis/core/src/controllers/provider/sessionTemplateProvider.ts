import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionTemplateProviderService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { sessionTemplateProviderPresenter } from '../../presenters';

let sessionTemplateProviderGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionTemplateProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionTemplateProviderId is required',
        description: 'The sessionTemplateProviderId path parameter is required.'
      })
    );
  }

  let sessionTemplateProvider = await subspaceSessionTemplateProviderService.get({
    instance: ctx.instance,
    sessionTemplateProviderId: ctx.params.sessionTemplateProviderId
  });

  return { sessionTemplateProvider };
});

export let sessionTemplateProviderController = Controller.create(
  {
    name: 'Session Template Providers',
    description:
      'Session template providers define which providers should be included when a session is created from a template.'
  },
  {
    list: instanceGroup
      .get(instancePath('session-template-providers', 'sessionTemplates.providers.list'), {
        name: 'List session template providers',
        description: 'Returns a paginated list of providers configured for a session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(sessionTemplateProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session template provider ID(s)'
            }),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session template ID(s)'
            }),
            session_template_template_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by session template template ID(s)' }
            ),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider config ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionTemplateProviderService.list({
          instance: ctx.instance,
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          sessionTemplateTemplateIds: normalizeArrayParam(
            ctx.query.session_template_template_id
          ),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, stp =>
          sessionTemplateProviderPresenter.present({ sessionTemplateProvider: stp })
        );
      }),

    get: sessionTemplateProviderGroup
      .get(
        instancePath(
          'session-template-providers/:sessionTemplateProviderId',
          'sessionTemplates.providers.get'
        ),
        {
          name: 'Get session template provider',
          description: 'Retrieves a specific provider configuration from a session template.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        return sessionTemplateProviderPresenter.present({
          sessionTemplateProvider: ctx.sessionTemplateProvider
        });
      }),

    create: instanceGroup
      .post(instancePath('session-template-providers', 'sessionTemplates.providers.create'), {
        name: 'Create session template provider',
        description: 'Adds a new provider configuration to a session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          session_template_id: v.string(),
          provider_deployment_id: v.optional(v.string()),
          provider_config_id: v.optional(v.string()),
          provider_auth_config_id: v.optional(v.string()),
          tool_filters: v.optional(v.object({ tool_keys: v.optional(v.array(v.string())) }))
        })
      )
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let stp = await subspaceSessionTemplateProviderService.create({
          instance: ctx.instance,
          sessionTemplateId: ctx.body.session_template_id,
          providerDeploymentId: ctx.body.provider_deployment_id,
          providerConfigId: ctx.body.provider_config_id,
          providerAuthConfigId: ctx.body.provider_auth_config_id,
          toolFilters: ctx.body.tool_filters
            ? { toolKeys: ctx.body.tool_filters.tool_keys }
            : undefined
        });

        return sessionTemplateProviderPresenter.present({ sessionTemplateProvider: stp });
      }),

    update: sessionTemplateProviderGroup
      .patch(
        instancePath(
          'session-template-providers/:sessionTemplateProviderId',
          'sessionTemplates.providers.update'
        ),
        {
          name: 'Update session template provider',
          description: 'Updates a provider configuration in a session template.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          tool_filters: v.optional(v.object({ tool_keys: v.optional(v.array(v.string())) }))
        })
      )
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let stp = await subspaceSessionTemplateProviderService.update({
          instance: ctx.instance,
          sessionTemplateProviderId: ctx.sessionTemplateProvider.id,
          toolFilters: ctx.body.tool_filters
            ? { toolKeys: ctx.body.tool_filters.tool_keys }
            : undefined
        });

        return sessionTemplateProviderPresenter.present({ sessionTemplateProvider: stp });
      }),

    delete: sessionTemplateProviderGroup
      .delete(
        instancePath(
          'session-template-providers/:sessionTemplateProviderId',
          'sessionTemplates.providers.delete'
        ),
        {
          name: 'Delete session template provider',
          description: 'Removes a provider configuration from a session template.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        await subspaceSessionTemplateProviderService.delete({
          instance: ctx.instance,
          sessionTemplateProviderId: ctx.sessionTemplateProvider.id
        });

        return sessionTemplateProviderPresenter.present({
          sessionTemplateProvider: ctx.sessionTemplateProvider
        });
      })
  }
);
