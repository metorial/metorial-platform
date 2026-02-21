import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceProviderConfigVaultService,
  type SubspaceProviderConfigVault
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerConfigVaultPresenter } from '../../presenters';

export let providerConfigVaultGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerConfigVaultId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerConfigVaultId is required',
        description: 'The providerConfigVaultId path parameter is required.'
      })
    );
  }

  let configVault = await subspaceProviderConfigVaultService.get({
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
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .outputList(providerConfigVaultPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderConfigVaultService.list({
          instance: ctx.instance,
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id)
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
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
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
          description: 'Creates a new provider config vault.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['Production Secrets'] }),
          description: v.optional(
            v.string({ examples: ['Secure storage for production credentials'] })
          ),
          metadata: v.optional(
            v.record(v.any(), { examples: [{ owner: 'platform-team', sensitivity: 'high' }] }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          data: v.record(v.any(), {
            description: 'Secure configuration values to store in the vault',
            examples: [{ api_key: 'sk-xxx', base_url: 'https://api.example.com' }]
          })
        })
      )
      .output(providerConfigVaultPresenter)
      .do(async ctx => {
        let configVault = await subspaceProviderConfigVaultService.create({
          instance: ctx.instance,
          providerId: ctx.deployment.providerId,
          providerDeploymentId: ctx.deployment.id,
          name: ctx.body.name,
          description: ctx.body.description,
          config: {
            type: 'inline',
            data: ctx.body.data
          },
          metadata: ctx.body.metadata
        });

        return providerConfigVaultPresenter.present({
          configVault: configVault as SubspaceProviderConfigVault
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
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
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
        let configVault = await subspaceProviderConfigVaultService.update({
          instance: ctx.instance,
          providerConfigVaultId: ctx.configVault.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return providerConfigVaultPresenter.present({
          configVault: configVault as SubspaceProviderConfigVault
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
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .output(providerConfigVaultPresenter)
      .do(async ctx => {
        return providerConfigVaultPresenter.present({
          configVault: ctx.configVault
        });
      })
  }
);
