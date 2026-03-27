import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v, ValidationTypeValue } from '@lowerdeck/validation';
import { subspaceSessionProviderService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import {
  authConfigValidator,
  configValidator,
  deploymentValidator
} from '../../lib/providerValidators';
import { checkAccess } from '../../middleware/checkAccess';
import {
  constrainFineGrainedSessionQuery,
  getFineGrainedAllowedSessionIds,
  requireFineGrainedSessionBody,
  requireFineGrainedSessionFromResource
} from '../../middleware/checkFineGrainedSessionAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { sessionProviderPresenter } from '../../presenters';
import { toolFiltersValidator } from './session';

let subspaceSessionProviderGroup = instanceGroup
  .use(async ctx => {
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
  })
  .use(
    requireFineGrainedSessionFromResource(
      ctx =>
        ctx.sessionProvider?.sessionId ??
        ctx.sessionProvider?.session_id ??
        ctx.sessionProvider?.session?.id
    )()
  );

type SessionProviderCreateInput = Parameters<typeof subspaceSessionProviderService.create>[0];

let sessionProviderCreateBodyValidator = v.intersection([
  v.object({
    session_id: v.string(),
    tool_filters: toolFiltersValidator
  }),
  v.union([deploymentValidator, configValidator, authConfigValidator])
]);

type SessionProviderCreateBody = ValidationTypeValue<
  typeof sessionProviderCreateBodyValidator
>;

let mapSessionProviderConfigSource = (
  config: SessionProviderCreateBody
): SessionProviderCreateInput['providerConfig'] => {
  if (!config) return undefined;

  if ('provider_config_id' in config && config.provider_config_id) {
    return { type: 'reference', providerConfigId: config.provider_config_id };
  }

  if ('provider_config' in config && config.provider_config) {
    let providerConfig = config.provider_config;
    return {
      type: 'ephemeral',
      name: providerConfig.name,
      config:
        'value' in providerConfig
          ? { type: 'inline', data: providerConfig.value }
          : {
              type: 'vault',
              providerConfigVaultId: providerConfig.provider_config_vault_id
            }
    };
  }
};

let mapSessionProviderDeploymentSource = (
  deployment: SessionProviderCreateBody
): SessionProviderCreateInput['providerDeployment'] => {
  if (!deployment) return undefined;

  if ('provider_deployment_id' in deployment && deployment.provider_deployment_id) {
    return { type: 'reference', providerDeploymentId: deployment.provider_deployment_id };
  }

  if ('provider_deployment' in deployment && deployment.provider_deployment) {
    let providerDeployment = deployment.provider_deployment;

    return {
      type: 'ephemeral',
      providerId: providerDeployment.provider_id,
      name: providerDeployment.name,
      description: providerDeployment.description,
      metadata: providerDeployment.metadata,
      lockedProviderVersionId: providerDeployment.locked_provider_version_id
    };
  }
};

let mapSessionProviderAuthConfigSource = (
  auth: SessionProviderCreateBody
): SessionProviderCreateInput['providerAuthConfig'] => {
  if (!auth) return undefined;

  if ('provider_auth_config_id' in auth && auth.provider_auth_config_id) {
    return { type: 'reference', providerAuthConfigId: auth.provider_auth_config_id };
  }

  if ('provider_auth_config' in auth && auth.provider_auth_config) {
    let inner = auth.provider_auth_config;

    return {
      type: 'ephemeral',
      name: inner.name,
      providerAuthMethodId: inner.provider_auth_method_id,
      providerId: inner.provider_id,
      credentials: inner.credentials
    };
  }
};

export let sessionProviderController = Controller.create(
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
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .use(constrainFineGrainedSessionQuery('session_id')())
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
            ),
            created_at: dateFilterValidator('session provider creation time'),
            updated_at: dateFilterValidator('session provider last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionProviderService.list({
          instance: ctx.instance,
          accessTagSessionIds: getFineGrainedAllowedSessionIds(ctx),
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          sessionIds: normalizeArrayParam(ctx.query.session_id),
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          status: normalizeArrayParam(ctx.query.status),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
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
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:read'],
          fineGrainedPolicy: 'allow'
        })
      )
      .output(sessionProviderPresenter)
      .do(async ctx => {
        return sessionProviderPresenter.present({ sessionProvider: ctx.sessionProvider });
      }),

    create: instanceGroup
      .post(instancePath('session-providers', 'sessions.providers.create'), {
        name: 'Create session provider',
        description: 'Adds a new provider to an active session.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'allow'
        })
      )
      .use(requireFineGrainedSessionBody('session_id')())
      .body('default', sessionProviderCreateBodyValidator)
      .output(sessionProviderPresenter)
      .do(async ctx => {
        let sessionProvider = await subspaceSessionProviderService.create({
          instance: ctx.instance,
          sessionId: ctx.body.session_id,
          providerDeployment: mapSessionProviderDeploymentSource(ctx.body),
          providerConfig: mapSessionProviderConfigSource(ctx.body),
          providerAuthConfig: mapSessionProviderAuthConfigSource(ctx.body),
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
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'allow'
        })
      )
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
      .use(
        checkAccess({
          possibleScopes: ['instance.provider.session:write'],
          fineGrainedPolicy: 'allow'
        })
      )
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
