import { convertKeysToCamelCase } from '@metorial/case';
import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionTemplateProviderService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import {
  authConfigValidator,
  configValidator,
  deploymentValidator
} from '../../lib/providerValidators';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { sessionTemplateProviderPresenter } from '../../presenters';

import { sessionTemplateGroup } from './sessionTemplate';

export let sessionTemplateProviderGroup = sessionTemplateGroup.use(async ctx => {
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
    list: sessionTemplateGroup
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
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionTemplateProviderService.list({
          instance: ctx.instance,
          sessionTemplateIds: [ctx.sessionTemplate.id]
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

    create: sessionTemplateGroup
      .post(instancePath('session-template-providers', 'sessionTemplates.providers.create'), {
        name: 'Create session template provider',
        description: 'Adds a new provider configuration to a session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          provider_deployment: deploymentValidator,
          provider_config: v.optional(configValidator),
          provider_auth_config: v.optional(authConfigValidator),
          tool_filters: v.optional(v.object({ tool_keys: v.optional(v.array(v.string())) }))
        })
      )
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let stp = await subspaceSessionTemplateProviderService.create({
          instance: ctx.instance,
          sessionTemplateId: ctx.sessionTemplate.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providerDeployment: convertKeysToCamelCase(ctx.body.provider_deployment),
          providerConfig: convertKeysToCamelCase(ctx.body.provider_config),
          providerAuthConfig: convertKeysToCamelCase(ctx.body.provider_auth_config),
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
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          provider_deployment: v.optional(deploymentValidator),
          provider_config: v.optional(configValidator),
          provider_auth_config: v.optional(authConfigValidator),
          tool_filters: v.optional(v.object({ tool_keys: v.optional(v.array(v.string())) }))
        })
      )
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let stp = await subspaceSessionTemplateProviderService.update({
          instance: ctx.instance,
          sessionTemplateProviderId: ctx.sessionTemplateProvider.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providerDeployment: convertKeysToCamelCase(ctx.body.provider_deployment),
          providerConfig: convertKeysToCamelCase(ctx.body.provider_config),
          providerAuthConfig: convertKeysToCamelCase(ctx.body.provider_auth_config),
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
