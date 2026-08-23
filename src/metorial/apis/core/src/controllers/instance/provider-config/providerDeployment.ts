import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v, ValidationTypeValue } from '@lowerdeck/validation';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { normalizeToolFilters } from '@metorial-subspace/module-provider-internal';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerDeploymentPresenter } from '@metorial/presenters';
import { toolFiltersValidator } from '../sessions/_shared';

let providerDeploymentGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerDeploymentId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerDeploymentId is required',
        description: 'The providerDeploymentId path parameter is required.'
      })
    );
  }

  let deployment = await providerDeploymentService.getProviderDeploymentById({
    instance: ctx.instance,
    providerDeploymentId: ctx.params.providerDeploymentId
  });

  return { deployment };
});

let createSchema = v.intersection([
  v.object({
    name: v.optional(v.string({ examples: ['Production Deployment'] })),
    description: v.optional(
      v.string({ examples: ['Main production environment configuration'] })
    ),
    metadata: v.optional(
      v.record(v.any(), {
        examples: [{ team: 'platform', environment: 'production' }]
      }),
      { description: 'Custom key-value pairs for storing additional information' }
    ),
    tool_filters: toolFiltersValidator,
    provider_id: v.string({
      examples: ['pro_5gHjKlMnPqRsTuVw'],
      description: 'The provider to deploy'
    }),
    locked_provider_version_id: v.optional(v.string({ examples: ['prv_4dEfGhJkLmNpQrSt'] }), {
      description: 'Pin this deployment to a specific provider version'
    })
  }),
  v.union([
    v.object({
      provider_config_id: v.optional(
        v.string({
          description: 'Existing provider config ID',
          examples: ['pcf_7dEfGhJkLmNpQrSt']
        })
      )
    }),
    v.object({
      provider_config: v.optional(
        v.union([
          v.object({
            name: v.optional(v.string({ examples: ['Default Config'] })),
            value: v.record(v.any(), {
              description: 'Provider-specific configuration values',
              examples: [{ api_key: 'sk-xxx', base_url: 'https://api.example.com' }]
            })
          }),
          v.object({
            name: v.optional(v.string({ examples: ['Default Config'] })),
            provider_config_vault_id: v.string({
              description: 'Provider config vault ID',
              examples: ['pcvt_3bCdEfGhJkLmNpQr']
            })
          })
        ])
      )
    })
  ])
]);

type ProviderDeploymentCreateConfig =
  | { type: 'reference'; providerConfigId: string }
  | {
      type: 'ephemeral';
      config:
        | { type: 'inline'; data: Record<string, any> }
        | { type: 'vault'; providerConfigVaultId: string };
    };

let mapProviderDeploymentConfig = (
  config: ValidationTypeValue<typeof createSchema>
): ProviderDeploymentCreateConfig | undefined => {
  if ('provider_config_id' in config && config.provider_config_id) {
    return {
      type: 'reference',
      providerConfigId: config.provider_config_id
    };
  }

  if ('provider_config' in config && config.provider_config) {
    let conf = config.provider_config;

    if ('value' in conf && conf.value) {
      return {
        type: 'ephemeral',
        config: {
          type: 'inline',
          data: conf.value
        }
      };
    }

    if ('provider_config_vault_id' in conf && conf.provider_config_vault_id) {
      return {
        type: 'ephemeral',
        config: {
          type: 'vault',
          providerConfigVaultId: conf.provider_config_vault_id
        }
      };
    }
  }

  return undefined;
};

export let providerDeploymentController = Controller.create(
  {
    name: 'Provider Deployments',
    description:
      'A deployment is a running instance of a provider, pinned to a specific version. Deployments support custom configuration values and user authentication.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-deployments', 'providerDeployments.list'), {
        name: 'List provider deployments',
        description: 'Returns a paginated list of provider deployments.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .outputList(providerDeploymentPresenter)
      .query(
        'mt_2026_01_01_magnetar',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by deployment ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_version_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by version ID(s)'
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by actor ID(s)'
            }),
            consumer_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by consumer ID(s)'
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity ID(s)'
            }),
            identity_credential_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity credential ID(s)'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              {
                description: 'Filter by status (active, archived)'
              }
            ),
            search: v.optional(v.string({ description: 'Search by name or description' })),
            created_at: dateFilterValidator('provider deployment creation time'),
            updated_at: dateFilterValidator('provider deployment last update time')
          })
        ),
        v => v
      )
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by deployment ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_version_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by version ID(s)'
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by actor ID(s)'
            }),
            consumer_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by consumer ID(s)'
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity ID(s)'
            }),
            identity_credential_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity credential ID(s)'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              {
                description: 'Filter by status (active, archived)'
              }
            ),

            capabilities: v.optional(
              v.object({
                supportsConfig: v.optional(v.boolean()),
                supportsAuth: v.optional(v.boolean()),
                supportsOAuth: v.optional(v.boolean()),
                supportsCallbacks: v.optional(v.boolean()),
                supportsOAuthAutoRegistration: v.optional(v.boolean()),
                supportsAuthExport: v.optional(v.boolean()),
                supportsAuthImport: v.optional(v.boolean())
              })
            ),

            search: v.optional(v.string({ description: 'Search by name or description' })),
            created_at: dateFilterValidator('provider deployment creation time'),
            updated_at: dateFilterValidator('provider deployment last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await providerDeploymentService.listProviderDeployments({
          instance: ctx.instance,
          allowDeleted: false,

          search: ctx.query.search,
          capabilities: ctx.query.capabilities,

          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerVersionIds: normalizeArrayParam(ctx.query.provider_version_id),
          actorIds: normalizeArrayParam(ctx.query.actor_id),
          consumerIds: normalizeArrayParam(ctx.query.consumer_id),
          identityIds: normalizeArrayParam(ctx.query.identity_id),
          identityCredentialIds: normalizeArrayParam(ctx.query.identity_credential_id),
          status: normalizeArrayParam(ctx.query.status),

          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, deployment =>
          providerDeploymentPresenter.present({
            deployment
          })
        );
      }),

    get: providerDeploymentGroup
      .get(
        instancePath('provider-deployments/:providerDeploymentId', 'providerDeployments.get'),
        {
          name: 'Get provider deployment',
          description: 'Retrieves a specific provider deployment by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .output(providerDeploymentPresenter)
      .do(async ctx => {
        return providerDeploymentPresenter.present({ deployment: ctx.deployment });
      }),

    create: instanceGroup
      .post(instancePath('provider-deployments', 'providerDeployments.create'), {
        name: 'Create provider deployment',
        description: 'Creates a new provider deployment.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .body('default', createSchema)
      .output(providerDeploymentPresenter)
      .do(async ctx => {
        let provider = await providerService.getProviderById({
          instance: ctx.instance,
          providerId: ctx.body.provider_id
        });
        let lockedVersion = ctx.body.locked_provider_version_id
          ? await providerVersionService.getProviderVersionById({
              instance: ctx.instance,
              providerVersionId: ctx.body.locked_provider_version_id
            })
          : undefined;
        let configInput = mapProviderDeploymentConfig(ctx.body);
        let config =
          configInput?.type === 'reference'
            ? {
                type: 'config' as const,
                config: await providerConfigService.getProviderConfigById({
                  instance: ctx.instance,
                  providerConfigId: configInput.providerConfigId
                })
              }
            : configInput?.config.type === 'inline'
              ? {
                  type: 'inline' as const,
                  data: configInput.config.data
                }
              : configInput?.config.type === 'vault'
                ? {
                    type: 'vault' as const,
                    vault: await providerConfigVaultService.getProviderConfigVaultById({
                      instance: ctx.instance,
                      providerConfigVaultId: configInput.config.providerConfigVaultId
                    })
                  }
                : { type: 'none' as const };

        let deployment = await providerDeploymentService.createProviderDeployment({
          instance: ctx.instance,
          provider,
          lockedVersion,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            config,
            metadata: ctx.body.metadata,
            toolFilters: normalizeToolFilters(ctx.body.tool_filters as any)
          }
        });

        return providerDeploymentPresenter.present({
          deployment
        });
      }),

    update: providerDeploymentGroup
      .patch(
        instancePath(
          'provider-deployments/:providerDeploymentId',
          'providerDeployments.update'
        ),
        {
          name: 'Update provider deployment',
          description: 'Updates a specific provider deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Deployment Name'] })),
          description: v.optional(
            v.string({ examples: ['Updated description for this deployment'] })
          ),
          metadata: v.optional(
            v.record(v.any(), { examples: [{ team: 'platform', environment: 'staging' }] }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          tool_filters: toolFiltersValidator,
          locked_provider_version_id: v.optional(
            v.nullable(v.string({ examples: ['prv_4dEfGhJkLmNpQrSt'] })),
            {
              description:
                'Pin this deployment to a specific provider version, or null to follow latest'
            }
          )
        })
      )
      .output(providerDeploymentPresenter)
      .do(async ctx => {
        if (ctx.body.locked_provider_version_id !== undefined && ctx.deployment.isEphemeral) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot update locked version on ephemeral provider deployment',
              description:
                'Ephemeral provider deployments are short-lived and cannot have their locked version changed.'
            })
          );
        }

        let lockedVersion:
          | Awaited<ReturnType<typeof providerVersionService.getProviderVersionById>>
          | null
          | undefined = undefined;
        if (ctx.body.locked_provider_version_id !== undefined) {
          lockedVersion =
            ctx.body.locked_provider_version_id === null
              ? null
              : await providerVersionService.getProviderVersionById({
                  instance: ctx.instance,
                  providerVersionId: ctx.body.locked_provider_version_id
                });

          if (lockedVersion && lockedVersion.providerOid !== ctx.deployment.providerOid) {
            throw new ServiceError(
              badRequestError({
                message: 'Provider version does not belong to this deployment provider',
                description:
                  'The locked provider version must belong to the same provider as the deployment.'
              })
            );
          }
        }

        let deployment = await providerDeploymentService.updateProviderDeployment({
          instance: ctx.instance,
          providerDeployment: ctx.deployment,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            ...(ctx.body.tool_filters !== undefined
              ? { toolFilters: normalizeToolFilters(ctx.body.tool_filters as any) }
              : {}),
            lockedVersion
          }
        });

        return providerDeploymentPresenter.present({
          deployment
        });
      }),

    delete: providerDeploymentGroup
      .delete(
        instancePath(
          'provider-deployments/:providerDeploymentId',
          'providerDeployments.delete'
        ),
        {
          name: 'Delete provider deployment',
          description: 'Permanently deletes a provider deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .output(providerDeploymentPresenter)
      .do(async ctx => {
        let deployment = await providerDeploymentService.archiveProviderDeployment({
          instance: ctx.instance,
          providerDeployment: ctx.deployment
        });

        return providerDeploymentPresenter.present({
          deployment
        });
      })
  }
);
