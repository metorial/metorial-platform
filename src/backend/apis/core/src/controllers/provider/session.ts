import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionService, subspaceProviderDeploymentService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerInstanceGroup, providerPath } from '../../middleware/providerGroup';
import { providerSessionPresenter } from '../../presenters';
import { SubspaceSession } from '../../presenters/types';

export let providerSessionGroup = providerInstanceGroup.use(async ctx => {
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
    list: providerInstanceGroup
      .get(providerPath('sessions', 'sessions.list'), {
        name: 'List sessions',
        description: 'Returns a paginated list of sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(providerSessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by session status' }
            ),
            provider_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by provider ID(s)' }
            ),
            provider_deployment_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by provider deployment ID(s)' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceSessionService.list({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status)?.[0],
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, session =>
          providerSessionPresenter.present({ session: session as SubspaceSession })
        );
      }),

    get: providerSessionGroup
      .get(providerPath('sessions/:sessionId', 'sessions.get'), {
        name: 'Get session',
        description: 'Retrieves a specific session by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerSessionPresenter)
      .do(async ctx => {
        return providerSessionPresenter.present({ session: ctx.session });
      }),

    create: providerInstanceGroup
      .post(providerPath('sessions', 'sessions.create'), {
        name: 'Create session',
        description: 'Creates a new session with provider deployments.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['My Session'] })),
          description: v.optional(v.string({ examples: ['Session for connecting to GitHub and Slack'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ environment: 'production' }] }), { description: 'Custom key-value pairs for storing additional information' }),
          provider_deployments: v.array(
            v.union([
              v.object({
                provider_deployment_id: v.string({ examples: ['pde_1aBcDeFgHjKlMnPq'], description: 'The ID of an existing provider deployment to connect to this session' })
              }, { name: 'existing_deployment', description: 'Connect to a pre-configured provider deployment that was created separately. Use this when you want to reuse the same deployment across multiple sessions.' }),
              v.object({
                provider_id: v.string({ examples: ['pro_5gHjKlMnPqRsTuVw'], description: 'The ID of the provider to create an ephemeral deployment for' }),
                name: v.optional(v.string({ examples: ['GitHub Provider'] }), { description: 'Display name for this ephemeral deployment' }),
                description: v.optional(v.string({ examples: ['Ephemeral GitHub deployment for this session'] }), { description: 'Description of the ephemeral deployment' }),
                metadata: v.optional(v.record(v.any(), { examples: [{ team: 'platform' }] }), { description: 'Custom key-value pairs for the ephemeral deployment' }),
                locked_provider_version_id: v.optional(v.string({ examples: ['prv_4dEfGhJkLmNpQrSt'] }), { description: 'Pin this ephemeral deployment to a specific provider version' }),
                config: v.optional(
                  v.union([
                    v.object({
                      type: v.literal('inline'),
                      data: v.record(v.any(), { description: 'Provider-specific configuration values', examples: [{ api_key: 'sk-xxx' }] })
                    }, { name: 'inline', description: 'Provide configuration values directly in the request' }),
                    v.object({
                      type: v.literal('config'),
                      provider_config_id: v.string({ description: 'Existing provider config ID', examples: ['pcf_7dEfGhJkLmNpQrSt'] })
                    }, { name: 'existing_config', description: 'Use an existing provider config by its ID' }),
                    v.object({
                      type: v.literal('vault'),
                      provider_config_vault_id: v.string({ description: 'Provider config vault ID', examples: ['pcvt_3bCdEfGhJkLmNpQr'] })
                    }, { name: 'from_vault', description: 'Create config from a vault template' })
                  ], { description: 'Configuration for this ephemeral deployment' })
                ),
                provider_auth_config_id: v.optional(v.string({ examples: ['pac_8hJkLmNpQrStUvWx'], description: 'Use an existing auth config (OAuth token, API key) for this deployment' }), { description: 'ID of an existing provider auth config to use for authentication. The auth config must belong to the same provider.' })
              }, { name: 'new_deployment', description: 'Create a temporary provider deployment that exists only for this session. The deployment will be cleaned up when the session ends.' })
            ], { description: 'Configuration for provider deployments to include in this session. You can mix existing and ephemeral deployments.' }),
            {
              description: 'List of provider deployments to connect to this session. Each element can either reference an existing deployment by ID, or specify a provider to create an ephemeral deployment.',
              examples: [
                [
                  { provider_deployment_id: 'pde_1aBcDeFgHjKlMnPq' },
                  { provider_id: 'pro_5gHjKlMnPqRsTuVw', name: 'Slack Provider', config: { type: 'inline', data: { api_key: 'xoxb-xxx' } }, provider_auth_config_id: 'pac_8hJkLmNpQrStUvWx' }
                ]
              ]
            }
          )
        })
      )
      .output(providerSessionPresenter)
      .do(async ctx => {
        let providerDeploymentsInput = ctx.body.provider_deployments;

        // Separate existing deployments from ephemeral ones
        let existingDeploymentIds = providerDeploymentsInput
          .filter((d): d is { provider_deployment_id: string } => 'provider_deployment_id' in d)
          .map(d => d.provider_deployment_id);

        let ephemeralDeployments = providerDeploymentsInput
          .filter((d): d is {
            provider_id: string;
            name?: string;
            description?: string;
            metadata?: Record<string, any>;
            locked_provider_version_id?: string;
            config?: { type: 'inline'; data: Record<string, any> } | { type: 'config'; provider_config_id: string } | { type: 'vault'; provider_config_vault_id: string };
            provider_auth_config_id?: string;
          } => 'provider_id' in d);

        // Validate existing deployments exist and are active
        let existingDeployments: { id: string; providerId: string }[] = [];
        if (existingDeploymentIds.length > 0) {
          for (let deploymentId of existingDeploymentIds) {
            let deployment = await subspaceProviderDeploymentService.get({
              instance: ctx.instance,
              providerDeploymentId: deploymentId
            });
            existingDeployments.push({
              id: deployment.id,
              providerId: deployment.providerId
            });
          }
        }

        // Create ephemeral deployments
        let createdDeployments: { id: string; providerId: string; isEphemeral: boolean }[] = [];
        for (let ephemeral of ephemeralDeployments) {
          // Transform config field to match service expected format
          let config:
            | { type: 'inline'; data: Record<string, any> }
            | { type: 'config'; providerConfigId: string }
            | { type: 'vault'; providerConfigVaultId: string }
            | undefined = undefined;
          if (ephemeral.config) {
            if (ephemeral.config.type === 'inline') {
              config = { type: 'inline', data: ephemeral.config.data };
            } else if (ephemeral.config.type === 'config') {
              config = { type: 'config', providerConfigId: ephemeral.config.provider_config_id };
            } else if (ephemeral.config.type === 'vault') {
              config = { type: 'vault', providerConfigVaultId: ephemeral.config.provider_config_vault_id };
            }
          }

          let deployment = await subspaceProviderDeploymentService.create({
            instance: ctx.instance,
            providerId: ephemeral.provider_id,
            name: ephemeral.name ?? null,
            description: ephemeral.description,
            metadata: ephemeral.metadata,
            lockedProviderVersionId: ephemeral.locked_provider_version_id,
            config,
            isEphemeral: true
          });
          createdDeployments.push({
            id: deployment.id,
            providerId: deployment.providerId,
            isEphemeral: true
          });
        }

        // Combine all deployments
        let allDeployments = [
          ...existingDeployments.map(d => ({ ...d, isEphemeral: false })),
          ...createdDeployments
        ];

        // Create the session with provider deployments
        let session = await subspaceSessionService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          providerDeployments: allDeployments.map(d => ({
            providerDeploymentId: d.id,
            providerId: d.providerId
          }))
        });

        return providerSessionPresenter.present({ session: session as SubspaceSession });
      }),

    delete: providerSessionGroup
      .delete(providerPath('sessions/:sessionId', 'sessions.delete'), {
        name: 'Delete session',
        description: 'Deletes a session.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerSessionPresenter)
      .do(async ctx => {
        let session = await subspaceSessionService.update({
          instance: ctx.instance,
          sessionId: ctx.session.id,
          status: 'deleted'
        });

        return providerSessionPresenter.present({ session: session as SubspaceSession });
      })
  }
);
