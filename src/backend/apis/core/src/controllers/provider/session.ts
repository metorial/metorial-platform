import { convertKeysToCamelCase } from '@metorial/case';
import { getConfig } from '@metorial/config';
import { Instance, Organization, OrganizationActor } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { apiKeyService } from '@metorial/module-machine-access';
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

let withConnectionUrl = (session: any, _instance: any) => ({
  ...session,
  connectionUrl: `${getConfig().urls.mcpUrl}/mcp/${session.id}`
});

let createSessionConnectionKey = async (d: {
  sessionId: string;
  instance: Instance;
  organization: Organization;
  actor: OrganizationActor;
  context: { ip: string; ua?: string | null };
}) => {
  let { secret } = await apiKeyService.createApiKey({
    input: {
      name: `Session ${d.sessionId}`
    },
    context: d.context,
    kind: 'system_internal',
    type: 'instance_access_token_secret',
    instance: d.instance,
    organization: d.organization,
    performedBy: d.actor
  });

  return secret.secret;
};

export let providerSessionGroup = instanceGroup.use(async ctx => {
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
            status: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionService.list({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status) as
            | ('active' | 'archived')[]
            | undefined,
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, session =>
          providerSessionPresenter.present({
            session: withConnectionUrl(session, ctx.instance)
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
          session: withConnectionUrl(ctx.session, ctx.instance)
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
              tool_filters: v.optional(
                v.object({ tool_keys: v.optional(v.array(v.string())) })
              )
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
            providerDeployment: convertKeysToCamelCase(p.provider_deployment),
            providerConfig: convertKeysToCamelCase(p.provider_config),
            providerAuthConfig: convertKeysToCamelCase(p.provider_auth_config),
            sessionTemplateId: p.session_template_id,
            toolFilters: p.tool_filters ? { toolKeys: p.tool_filters.tool_keys } : undefined
          }))
        });

        let connectionKey = await createSessionConnectionKey({
          sessionId: subspaceSession.id,
          instance: ctx.instance,
          organization: ctx.organization,
          actor: ctx.actor,
          context: { ip: ctx.context.ip, ua: ctx.context.ua }
        });

        return providerSessionPresenter.present({
          session: {
            ...withConnectionUrl(subspaceSession, ctx.instance),
            connectionKey
          }
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
          session: withConnectionUrl(session, ctx.instance)
        });
      }),

    delete: providerSessionGroup
      .delete(instancePath('sessions/:sessionId', 'sessions.delete'), {
        name: 'Delete session',
        description: 'Deletes a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(providerSessionPresenter)
      .do(async ctx => {
        let session = await subspaceSessionService.update({
          instance: ctx.instance,
          sessionId: ctx.session.id,
          status: 'deleted'
        });

        return providerSessionPresenter.present({
          session: withConnectionUrl(session, ctx.instance)
        });
      })
  }
);
