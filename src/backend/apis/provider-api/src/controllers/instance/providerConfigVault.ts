import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderConfigVaultService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { configVaultPresenter, deleteResponsePresenter } from '../../presenters';
import { SubspaceConfigVault } from '../../presenters/types';

export let providerConfigVaultGroup = providerInstanceGroup.use(async ctx => {
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
    description: 'Manage secure config vaults for provider credentials.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-config-vaults', 'providerConfigVaults.list'), {
        name: 'List provider config vaults',
        description: 'Returns a paginated list of provider config vaults.'
      })
      .outputList(configVaultPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_deployment_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderConfigVaultService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerDeploymentId: ctx.query.provider_deployment_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, configVault =>
          configVaultPresenter.present({ configVault: configVault as SubspaceConfigVault })
        );
      }),

    get: providerConfigVaultGroup
      .get(providerPath('provider-config-vaults/:providerConfigVaultId', 'providerConfigVaults.get'), {
        name: 'Get provider config vault',
        description: 'Retrieves a specific provider config vault by ID.'
      })
      .output(configVaultPresenter)
      .do(async ctx => {
        return configVaultPresenter.present({ configVault: ctx.configVault });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-config-vaults', 'providerConfigVaults.create'), {
        name: 'Create provider config vault',
        description: 'Creates a new provider config vault.'
      })
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          isEphemeral: v.optional(v.boolean()),
          providerId: v.string(),
          providerDeploymentId: v.optional(v.string()),
          data: v.record(v.any())
        })
      )
      .output(configVaultPresenter)
      .do(async ctx => {
        let configVault = await subspaceProviderConfigVaultService.create({
          instance: ctx.instance,
          providerId: ctx.body.providerId,
          providerDeploymentId: ctx.body.providerDeploymentId,
          name: ctx.body.name,
          description: ctx.body.description,
          isEphemeral: ctx.body.isEphemeral,
          data: ctx.body.data,
          metadata: ctx.body.metadata
        });

        return configVaultPresenter.present({ configVault: configVault as SubspaceConfigVault });
      }),

    update: providerConfigVaultGroup
      .patch(providerPath('provider-config-vaults/:providerConfigVaultId', 'providerConfigVaults.update'), {
        name: 'Update provider config vault',
        description: 'Updates a specific provider config vault.'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(configVaultPresenter)
      .do(async ctx => {
        let configVault = await subspaceProviderConfigVaultService.update({
          instance: ctx.instance,
          providerConfigVaultId: ctx.configVault.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return configVaultPresenter.present({ configVault: configVault as SubspaceConfigVault });
      }),

    delete: providerConfigVaultGroup
      .delete(providerPath('provider-config-vaults/:providerConfigVaultId', 'providerConfigVaults.delete'), {
        name: 'Delete provider config vault',
        description: 'Permanently deletes a provider config vault.'
      })
      .output(deleteResponsePresenter)
      .do(async ctx => {
        await subspaceProviderConfigVaultService.delete({
          instance: ctx.instance,
          providerConfigVaultId: ctx.configVault.id
        });

        return deleteResponsePresenter.present({
          id: ctx.configVault.id,
          object: 'provider.config_vault'
        });
      })
  }
);
