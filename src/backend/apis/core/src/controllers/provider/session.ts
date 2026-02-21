import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionService } from '@metorial/module-subspace';
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
import { providerSessionPresenter } from '../../presenters';

let providerSessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionId is required',
        description: 'The sessionId path parameter is required.'
      })
    );
  }

  let session = await subspaceSessionService.get({
    instance: ctx.instance,
    sessionId: ctx.params.sessionId
  });

  return { session };
});

export let toolFilterValidator = v.union([
  v.object({
    type: v.literal('tool_keys'),
    keys: v.array(v.string())
  }),
  v.object({
    type: v.literal('tool_regex'),
    pattern: v.string()
  }),
  v.object({
    type: v.literal('resource_regex'),
    pattern: v.string()
  }),
  v.object({
    type: v.literal('resource_uris'),
    uris: v.array(v.string())
  }),
  v.object({
    type: v.literal('prompt_keys'),
    keys: v.array(v.string())
  }),
  v.object({
    type: v.literal('prompt_regex'),
    pattern: v.string()
  })
]);

export let toolFiltersValidator = v.nullable(
  v.optional(v.union([toolFilterValidator, v.array(toolFilterValidator)]))
);

type SessionCreateProviderInput = Parameters<
  typeof subspaceSessionService.create
>[0]['providers'][number];

let mapSessionConfigSource = (
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
): SessionCreateProviderInput['providerConfig'] => {
  if (!config) return undefined;

  if (typeof config === 'string') {
    return { type: 'reference', providerConfigId: config };
  }

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

let mapSessionDeploymentSource = (
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
): SessionCreateProviderInput['providerDeployment'] => {
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
    config: mapSessionConfigSource(deployment.config)
  };
};

let mapSessionAuthConfigSource = (
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
): SessionCreateProviderInput['providerAuthConfig'] => {
  if (!auth) return undefined;

  if (typeof auth === 'string') {
    return { type: 'reference', providerAuthConfigId: auth };
  }

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

export let providerSessionController = Controller.create(
  {
    name: 'Sessions',
    description:
      'Sessions are connections to providers that allow clients to interact with MCP servers. Each session can include one or more provider deployments.'
  },
  {
    list: instanceGroup
      .get(instancePath('sessions', 'sessions.list'), {
        name: 'List sessions',
        description: 'Returns a paginated list of sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(providerSessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              { description: 'Filter by status (active, archived)' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session ID(s)'
            }),
            session_template_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session template ID(s)'
            }),
            session_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by session provider ID(s)'
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
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionService.list({
          instance: ctx.instance,
          allowDeleted: false,

          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          sessionTemplateIds: normalizeArrayParam(ctx.query.session_template_id),
          sessionProviderIds: normalizeArrayParam(ctx.query.session_provider_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, session =>
          providerSessionPresenter.present({
            session
          })
        );
      }),

    get: providerSessionGroup
      .get(instancePath('sessions/:sessionId', 'sessions.get'), {
        name: 'Get session',
        description: 'Retrieves a specific session by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(providerSessionPresenter)
      .do(async ctx => {
        return providerSessionPresenter.present({
          session: ctx.session
        });
      }),

    create: instanceGroup
      .post(instancePath('sessions', 'sessions.create'), {
        name: 'Create session',
        description: 'Creates a new session with provider deployments.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          providers: v.array(
            v.object({
              provider_deployment: deploymentValidator,
              provider_config: v.optional(configValidator),
              provider_auth_config: v.optional(authConfigValidator),
              session_template_id: v.optional(v.string()),
              tool_filters: toolFiltersValidator
            })
          )
        })
      )
      .output(providerSessionPresenter)
      .do(async ctx => {
        let subspaceSession = await subspaceSessionService.create({
          instance: ctx.instance,
          name: ctx.body.name ?? `Session ${new Date().toISOString()}`,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providers: ctx.body.providers.map(p => ({
            providerDeployment: mapSessionDeploymentSource(p.provider_deployment),
            providerConfig: mapSessionConfigSource(p.provider_config),
            providerAuthConfig: mapSessionAuthConfigSource(p.provider_auth_config),
            sessionTemplateId: p.session_template_id,
            toolFilters: p.tool_filters
          }))
        });

        return providerSessionPresenter.present({
          session: subspaceSession
        });
      }),

    update: providerSessionGroup
      .patch(instancePath('sessions/:sessionId', 'sessions.update'), {
        name: 'Update session',
        description: 'Updates a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['My updated session'] })),
          description: v.optional(v.string({ examples: ['Updated session description'] })),
          metadata: v.optional(v.record(v.any()), {
            description: 'Custom key-value pairs for storing additional information'
          })
        })
      )
      .output(providerSessionPresenter)
      .do(async ctx => {
        let session = await subspaceSessionService.update({
          instance: ctx.instance,
          sessionId: ctx.session.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return providerSessionPresenter.present({
          session: session
        });
      })
  }
);
