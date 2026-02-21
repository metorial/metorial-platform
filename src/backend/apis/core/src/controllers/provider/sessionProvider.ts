import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionProviderService } from '@metorial/module-subspace';
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
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { sessionProviderPresenter } from '../../presenters';
import { toolFiltersValidator } from './session';

let subspaceSessionProviderGroup = instanceGroup.use(async ctx => {
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

type SessionProviderCreateInput = Parameters<typeof subspaceSessionProviderService.create>[0];

let mapSessionProviderConfigSource = (
  config:
    | { type: 'none' }
    | { type: 'reference'; provider_config_id: string }
    | {
        type: 'ephemeral';
        name?: string;
        config:
          | { type: 'inline'; data: Record<string, any> }
          | { type: 'vault'; provider_config_vault_id: string };
      }
    | string
    | undefined
): SessionProviderCreateInput['providerConfig'] => {
  if (!config) return undefined;
  if (typeof config === 'string') return { type: 'reference', providerConfigId: config };
  if (config.type === 'none') return undefined;
  if (config.type === 'reference') {
    return { type: 'reference', providerConfigId: config.provider_config_id };
  }
  return {
    type: 'ephemeral',
    name: config.name,
    config:
      config.config.type === 'inline'
        ? { type: 'inline', data: config.config.data }
        : { type: 'vault', providerConfigVaultId: config.config.provider_config_vault_id }
  };
};

let mapSessionProviderDeploymentSource = (
  deployment:
    | { type: 'reference'; provider_deployment_id: string }
    | {
        type: 'ephemeral';
        provider_id: string;
        name?: string;
        description?: string;
        metadata?: Record<string, any>;
        locked_provider_version_id?: string;
        config?:
          | { type: 'none' }
          | { type: 'reference'; provider_config_id: string }
          | {
              type: 'ephemeral';
              name?: string;
              config:
                | { type: 'inline'; data: Record<string, any> }
                | { type: 'vault'; provider_config_vault_id: string };
            }
          | string;
      }
    | string
): SessionProviderCreateInput['providerDeployment'] => {
  if (typeof deployment === 'string') {
    return { type: 'reference', providerDeploymentId: deployment };
  }
  if (deployment.type === 'reference') {
    return { type: 'reference', providerDeploymentId: deployment.provider_deployment_id };
  }
  return {
    type: 'ephemeral',
    providerId: deployment.provider_id,
    name: deployment.name,
    description: deployment.description,
    metadata: deployment.metadata,
    lockedProviderVersionId: deployment.locked_provider_version_id,
    config: mapSessionProviderConfigSource(deployment.config)
  };
};

let mapSessionProviderAuthConfigSource = (
  auth:
    | { type: 'reference'; provider_auth_config_id: string }
    | {
        type: 'ephemeral';
        name?: string;
        provider_auth_method_id: string;
        credentials: Record<string, any>;
      }
    | string
    | undefined
): SessionProviderCreateInput['providerAuthConfig'] => {
  if (!auth) return undefined;
  if (typeof auth === 'string') return { type: 'reference', providerAuthConfigId: auth };
  if (auth.type === 'reference') {
    return { type: 'reference', providerAuthConfigId: auth.provider_auth_config_id };
  }
  return {
    type: 'ephemeral',
    name: auth.name,
    providerAuthMethodId: auth.provider_auth_method_id,
    credentials: auth.credentials
  };
};

export let subspaceSessionProviderController = Controller.create(
  {
    name: 'Session Providers',
    description:
      'Session providers represent the providers that are actively connected to a session. Each session can have multiple providers, and providers can be added or removed during the session lifecycle.'
  },
  {
    list: instanceGroup
      .get(instancePath('session-providers', 'sessions.providers.list'), {
        name: 'List session providers',
        description: 'Returns a paginated list of providers connected to a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(sessionProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
            }),
            session_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session template ID(s)'
            }),
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
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              { description: 'Filter by provider status' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionProviderService.list({
          instance: ctx.instance,
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          status: normalizeArrayParam(ctx.query.status)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, sessionProvider =>
          sessionProviderPresenter.present({
            sessionProvider
          })
        );
      }),

    get: subspaceSessionProviderGroup
      .get(instancePath('session-providers/:sessionProviderId', 'sessions.providers.get'), {
        name: 'Get session provider',
        description: 'Retrieves a specific provider connected to a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(sessionProviderPresenter)
      .do(async ctx => {
        return sessionProviderPresenter.present({ sessionProvider: ctx.sessionProvider });
      }),

    create: instanceGroup
      .post(instancePath('session-providers', 'sessions.providers.create'), {
        name: 'Create session provider',
        description: 'Adds a new provider to an active session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          session_id: v.string(),
          provider_deployment: deploymentValidator,
          provider_config: v.optional(configValidator),
          provider_auth_config: v.optional(authConfigValidator),
          tool_filters: toolFiltersValidator
        })
      )
      .output(sessionProviderPresenter)
      .do(async ctx => {
        let sessionProvider = await subspaceSessionProviderService.create({
          instance: ctx.instance,
          sessionId: ctx.body.session_id,
          providerDeployment: mapSessionProviderDeploymentSource(ctx.body.provider_deployment),
          providerConfig: mapSessionProviderConfigSource(ctx.body.provider_config),
          providerAuthConfig: mapSessionProviderAuthConfigSource(
            ctx.body.provider_auth_config
          ),
          toolFilters: ctx.body.tool_filters
        });

        return sessionProviderPresenter.present({
          sessionProvider
        });
      }),

    update: subspaceSessionProviderGroup
      .patch(
        instancePath('session-providers/:sessionProviderId', 'sessions.providers.update'),
        {
          name: 'Update session provider',
          description: 'Updates a provider connected to a session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          tool_filters: toolFiltersValidator
        })
      )
      .output(sessionProviderPresenter)
      .do(async ctx => {
        let sessionProvider = await subspaceSessionProviderService.update({
          instance: ctx.instance,
          sessionProviderId: ctx.sessionProvider.id,
          toolFilters: ctx.body.tool_filters
        });

        return sessionProviderPresenter.present({
          sessionProvider
        });
      }),

    delete: subspaceSessionProviderGroup
      .delete(
        instancePath('session-providers/:sessionProviderId', 'sessions.providers.delete'),
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
