import { convertKeysToCamelCase } from '@metorial/case';
import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceSessionProviderService,
  type SubspaceSessionProvider
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import {
  authConfigValidator,
  configValidator,
  deploymentValidator
} from '../../lib/providerValidators';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { sessionProviderPresenter } from '../../presenters';

import { subspaceSessionGroup } from './subspaceSession';

export let subspaceSessionProviderGroup = subspaceSessionGroup.use(async ctx => {
  if (!ctx.params.sessionProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionProviderId is required',
        description: 'The sessionProviderId path parameter is required.'
      })
    );
  }

  let sessionProvider = await subspaceSessionProviderService.get({
    instance: ctx.instance,
    sessionProviderId: ctx.params.sessionProviderId
  });

  return { sessionProvider };
});

export let subspaceSessionProviderController = Controller.create(
  {
    name: 'Session Providers',
    description:
      'Session providers represent the providers that are actively connected to a session. Each session can have multiple providers, and providers can be added or removed during the session lifecycle.'
  },
  {
    list: subspaceSessionGroup
      .get(instancePath('sessions/:sessionId/providers', 'sessions.providers.list'), {
        name: 'List session providers',
        description: 'Returns a paginated list of providers connected to a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(sessionProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            status: v.optional(v.string(), { description: 'Filter by provider status' })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionProviderService.list({
          instance: ctx.instance,
          sessionIds: [ctx.session.id],
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          status: ctx.query.status
            ? ([ctx.query.status] as ('active' | 'archived')[])
            : undefined
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionProvider =>
          sessionProviderPresenter.present({
            sessionProvider: sessionProvider as SubspaceSessionProvider
          })
        );
      }),

    get: subspaceSessionProviderGroup
      .get(
        instancePath(
          'sessions/:sessionId/providers/:sessionProviderId',
          'sessions.providers.get'
        ),
        {
          name: 'Get session provider',
          description: 'Retrieves a specific provider connected to a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(sessionProviderPresenter)
      .do(async ctx => {
        return sessionProviderPresenter.present({ sessionProvider: ctx.sessionProvider });
      }),

    create: subspaceSessionGroup
      .post(instancePath('sessions/:sessionId/providers', 'sessions.providers.create'), {
        name: 'Create session provider',
        description: 'Adds a new provider to an active session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['GitHub Provider'] })),
          description: v.optional(v.string({ examples: ['GitHub integration'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ version: '1.0' }] }), {
            description: 'Custom key-value pairs'
          }),
          provider_deployment: deploymentValidator,
          provider_config: v.optional(configValidator),
          provider_auth_config: v.optional(authConfigValidator),
          tool_filters: v.optional(v.object({ tool_keys: v.optional(v.array(v.string())) }))
        })
      )
      .output(sessionProviderPresenter)
      .do(async ctx => {
        let sessionProvider = await subspaceSessionProviderService.create({
          instance: ctx.instance,
          sessionId: ctx.session.id,
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

        return sessionProviderPresenter.present({
          sessionProvider: sessionProvider as SubspaceSessionProvider
        });
      }),

    update: subspaceSessionProviderGroup
      .patch(
        instancePath(
          'sessions/:sessionId/providers/:sessionProviderId',
          'sessions.providers.update'
        ),
        {
          name: 'Update session provider',
          description: 'Updates a provider connected to a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Provider Name'] })),
          description: v.optional(v.string({ examples: ['Updated description'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ version: '2.0' }] }), {
            description: 'Custom key-value pairs'
          })
        })
      )
      .output(sessionProviderPresenter)
      .do(async ctx => {
        let sessionProvider = await subspaceSessionProviderService.update({
          instance: ctx.instance,
          sessionProviderId: ctx.sessionProvider.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return sessionProviderPresenter.present({
          sessionProvider: sessionProvider as SubspaceSessionProvider
        });
      }),

    delete: subspaceSessionProviderGroup
      .delete(
        instancePath(
          'sessions/:sessionId/providers/:sessionProviderId',
          'sessions.providers.delete'
        ),
        {
          name: 'Delete session provider',
          description: 'Removes a provider from a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(sessionProviderPresenter)
      .do(async ctx => {
        await subspaceSessionProviderService.delete({
          instance: ctx.instance,
          sessionProviderId: ctx.sessionProvider.id
        });

        return sessionProviderPresenter.present({ sessionProvider: ctx.sessionProvider });
      })
  }
);
