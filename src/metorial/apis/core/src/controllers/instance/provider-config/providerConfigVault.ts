import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerService } from '@metorial-subspace/module-catalog';
import {
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerConfigVaultPresenter } from '@metorial/presenters';

let providerConfigVaultGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerConfigVaultId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerConfigVaultId is required',
        description: 'The providerConfigVaultId path parameter is required.'
      })
    );
  }

  let configVault = await providerConfigVaultService.getProviderConfigVaultById({
    instance: ctx.instance,
    providerConfigVaultId: ctx.params.providerConfigVaultId
  });

  return { configVault };
});

export let providerConfigVaultController = Controller.create(
  {
    name: 'Provider Config Vaults',
    description:
      'A config vault is a saved, reusable set of configuration values. Use vaults to store credentials once and apply them to multiple deployments without re-entering.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-config-vaults', 'providerDeployments.configVaults.list'), {
        name: 'List provider config vaults',
        description: 'Returns a paginated list of provider config vaults.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.config_vault:read'] }))
      .outputList(providerConfigVaultPresenter)
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
              description: 'Filter by config vault ID(s)'
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
            provider_config_vault_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by config vault ID(s)'
            }),
            search: v.optional(v.string({ description: 'Search by name or description' })),
            created_at: dateFilterValidator('provider config vault creation time'),
            updated_at: dateFilterValidator('provider config vault last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await providerConfigVaultService.listProviderConfigVaults({
          instance: ctx.instance,
          allowDeleted: false,

          search: ctx.query.search,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, configVault =>
          providerConfigVaultPresenter.present({
            configVault: configVault
          })
        );
      }),

    get: providerConfigVaultGroup
      .get(
        instancePath(
          'provider-config-vaults/:providerConfigVaultId',
          'providerDeployments.configVaults.get'
        ),
        {
          name: 'Get provider config vault',
          description: 'Retrieves a specific provider config vault by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.config_vault:read'] }))
      .output(providerConfigVaultPresenter)
      .do(async ctx => {
        return providerConfigVaultPresenter.present({
          configVault: ctx.configVault
        });
      }),

    create: instanceGroup
      .post(
        instancePath('provider-config-vaults', 'providerDeployments.configVaults.create'),
        {
          name: 'Create provider config vault',
          description: 'Creates a new provider config vault.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.config_vault:write'] }))
      .body(
        'default',
        v.object({
          provider_id: v.string({
            description: 'Provider ID',
            examples: ['pro_5gHjKlMnPqRsTuVw']
          }),
          provider_deployment_id: v.optional(
            v.string({
              description: 'Provider deployment ID',
              examples: ['pdp_4dEfGhJkLmNpQrSt']
            })
          ),

          name: v.string({ examples: ['Production Secrets'] }),
          description: v.optional(
            v.string({ examples: ['Secure storage for production credentials'] })
          ),
          metadata: v.optional(
            v.record(v.any(), { examples: [{ owner: 'platform-team', sensitivity: 'high' }] }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),

          value: v.record(v.any(), {
            description: 'Secure configuration values to store in the vault',
            examples: [{ api_key: 'sk-xxx', base_url: 'https://api.example.com' }]
          })
        })
      )
      .output(providerConfigVaultPresenter)
      .do(async ctx => {
        let provider = await providerService.getProviderById({
          instance: ctx.instance,
          providerId: ctx.body.provider_id
        });
        let providerDeployment = ctx.body.provider_deployment_id
          ? await providerDeploymentService.getProviderDeploymentById({
              instance: ctx.instance,
              providerDeploymentId: ctx.body.provider_deployment_id
            })
          : undefined;

        let configVault = await providerConfigVaultService.createProviderConfigVault({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          provider,
          providerDeployment,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            config: {
              type: 'inline',
              data: ctx.body.value
            },
            metadata: ctx.body.metadata
          }
        });

        return providerConfigVaultPresenter.present({
          configVault
        });
      }),

    update: providerConfigVaultGroup
      .patch(
        instancePath(
          'provider-config-vaults/:providerConfigVaultId',
          'providerDeployments.configVaults.update'
        ),
        {
          name: 'Update provider config vault',
          description: 'Updates a specific provider config vault.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.config_vault:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Vault Name'] })),
          description: v.optional(v.string({ examples: ['Updated vault description'] })),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ owner: 'platform-team', sensitivity: 'critical' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          )
        })
      )
      .output(providerConfigVaultPresenter)
      .do(async ctx => {
        let configVault = await providerConfigVaultService.updateProviderConfigVault({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          providerConfigVault: ctx.configVault,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return providerConfigVaultPresenter.present({
          configVault
        });
      }),

    delete: providerConfigVaultGroup
      .delete(
        instancePath(
          'provider-config-vaults/:providerConfigVaultId',
          'providerDeployments.configVaults.delete'
        ),
        {
          name: 'Delete provider config vault',
          description: 'Permanently deletes a provider config vault.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.config_vault:write'] }))
      .output(providerConfigVaultPresenter)
      .do(async ctx => {
        let configVault = await providerConfigVaultService.archiveProviderConfigVault({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          providerConfigVault: ctx.configVault
        });

        return providerConfigVaultPresenter.present({
          configVault
        });
      })
  }
);
