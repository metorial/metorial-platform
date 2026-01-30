import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionTemplateProviderService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerPath } from '../../middleware/providerGroup';
import { sessionTemplateProviderPresenter } from '../../presenters';
import { SubspaceSessionTemplateProvider } from '../../presenters/types';
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
      'Session template providers define which providers should be included when a session is created from a template. Each template can have multiple providers configured.'
  },
  {
    list: sessionTemplateGroup
      .get(providerPath('session-templates/:sessionTemplateId/providers', 'sessionTemplates.providers.list'), {
        name: 'List session template providers',
        description: 'Returns a paginated list of providers configured for a session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(sessionTemplateProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by provider ID(s)' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionTemplateProviderService.list({
          instance: ctx.instance,
          sessionTemplateId: ctx.sessionTemplate.id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionTemplateProvider =>
          sessionTemplateProviderPresenter.present({ sessionTemplateProvider: sessionTemplateProvider as SubspaceSessionTemplateProvider })
        );
      }),

    get: sessionTemplateProviderGroup
      .get(providerPath('session-templates/:sessionTemplateId/providers/:sessionTemplateProviderId', 'sessionTemplates.providers.get'), {
        name: 'Get session template provider',
        description: 'Retrieves a specific provider configuration from a session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        return sessionTemplateProviderPresenter.present({ sessionTemplateProvider: ctx.sessionTemplateProvider });
      }),

    create: sessionTemplateGroup
      .post(providerPath('session-templates/:sessionTemplateId/providers', 'sessionTemplates.providers.create'), {
        name: 'Create session template provider',
        description: 'Adds a new provider configuration to a session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['GitHub Provider'] })),
          description: v.optional(v.string({ examples: ['GitHub integration for this template'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ priority: 1 }] }), { description: 'Custom key-value pairs' }),
          providerId: v.string({ examples: ['pro_5gHjKlMnPqRsTuVw'], description: 'The provider to add to the template' }),
          providerDeploymentId: v.optional(v.string({ examples: ['pde_1aBcDeFgHjKlMnPq'] }), { description: 'Specific deployment to use' })
        })
      )
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let sessionTemplateProvider = await subspaceSessionTemplateProviderService.create({
          instance: ctx.instance,
          sessionTemplateId: ctx.sessionTemplate.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providerId: ctx.body.providerId,
          providerDeploymentId: ctx.body.providerDeploymentId
        });

        return sessionTemplateProviderPresenter.present({ sessionTemplateProvider: sessionTemplateProvider as SubspaceSessionTemplateProvider });
      }),

    update: sessionTemplateProviderGroup
      .patch(providerPath('session-templates/:sessionTemplateId/providers/:sessionTemplateProviderId', 'sessionTemplates.providers.update'), {
        name: 'Update session template provider',
        description: 'Updates a provider configuration in a session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Provider Name'] })),
          description: v.optional(v.string({ examples: ['Updated description'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ priority: 2 }] }), { description: 'Custom key-value pairs' }),
          providerDeploymentId: v.optional(v.string({ examples: ['pde_1aBcDeFgHjKlMnPq'] }), { description: 'Specific deployment to use' })
        })
      )
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        let sessionTemplateProvider = await subspaceSessionTemplateProviderService.update({
          instance: ctx.instance,
          sessionTemplateProviderId: ctx.sessionTemplateProvider.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providerDeploymentId: ctx.body.providerDeploymentId
        });

        return sessionTemplateProviderPresenter.present({ sessionTemplateProvider: sessionTemplateProvider as SubspaceSessionTemplateProvider });
      }),

    delete: sessionTemplateProviderGroup
      .delete(providerPath('session-templates/:sessionTemplateId/providers/:sessionTemplateProviderId', 'sessionTemplates.providers.delete'), {
        name: 'Delete session template provider',
        description: 'Removes a provider configuration from a session template.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(sessionTemplateProviderPresenter)
      .do(async ctx => {
        await subspaceSessionTemplateProviderService.delete({
          instance: ctx.instance,
          sessionTemplateProviderId: ctx.sessionTemplateProvider.id
        });

        return sessionTemplateProviderPresenter.present({ sessionTemplateProvider: ctx.sessionTemplateProvider });
      })
  }
);
