import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderDeploymentService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { deploymentPresenter, deleteResponsePresenter } from '../../presenters';
import { SubspaceDeployment } from '../../presenters/types';

export let providerDeploymentGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerDeploymentId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerDeploymentId is required',
        description: 'The providerDeploymentId path parameter is required.'
      })
    );
  }

  let deployment = await subspaceProviderDeploymentService.get({
    instance: ctx.instance,
    providerDeploymentId: ctx.params.providerDeploymentId
  });

  return { deployment };
});

export let providerDeploymentController = Controller.create(
  {
    name: 'Provider Deployments',
    description: 'Manage provider deployments within an instance.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-deployments', 'providerDeployments.list'), {
        name: 'List provider deployments',
        description: 'Returns a paginated list of provider deployments.'
      })
      .outputList(deploymentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_version_id: v.optional(v.string()),
            status: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderDeploymentService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerVersionId: ctx.query.provider_version_id,
          status: ctx.query.status
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, deployment =>
          deploymentPresenter.present({ deployment: deployment as SubspaceDeployment })
        );
      }),

    get: providerDeploymentGroup
      .get(providerPath('provider-deployments/:providerDeploymentId', 'providerDeployments.get'), {
        name: 'Get provider deployment',
        description: 'Retrieves a specific provider deployment by ID.'
      })
      .output(deploymentPresenter)
      .do(async ctx => {
        return deploymentPresenter.present({ deployment: ctx.deployment });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-deployments', 'providerDeployments.create'), {
        name: 'Create provider deployment',
        description: 'Creates a new provider deployment.'
      })
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          isEphemeral: v.optional(v.boolean()),
          providerId: v.string(),
          lockedProviderVersionId: v.optional(v.string()),
          config: v.optional(
            v.union([
              v.object({ type: v.literal('none') }),
              v.object({ type: v.literal('inline'), data: v.record(v.any()) }),
              v.object({ type: v.literal('vault'), providerConfigVaultId: v.string() })
            ])
          )
        })
      )
      .output(deploymentPresenter)
      .do(async ctx => {
        let deployment = await subspaceProviderDeploymentService.create({
          instance: ctx.instance,
          providerId: ctx.body.providerId,
          name: ctx.body.name,
          description: ctx.body.description,
          isEphemeral: ctx.body.isEphemeral,
          lockedProviderVersionId: ctx.body.lockedProviderVersionId,
          config: ctx.body.config,
          metadata: ctx.body.metadata
        });

        return deploymentPresenter.present({ deployment: deployment as SubspaceDeployment });
      }),

    update: providerDeploymentGroup
      .patch(providerPath('provider-deployments/:providerDeploymentId', 'providerDeployments.update'), {
        name: 'Update provider deployment',
        description: 'Updates a specific provider deployment.'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(deploymentPresenter)
      .do(async ctx => {
        let deployment = await subspaceProviderDeploymentService.update({
          instance: ctx.instance,
          providerDeploymentId: ctx.deployment.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return deploymentPresenter.present({ deployment: deployment as SubspaceDeployment });
      }),

    delete: providerDeploymentGroup
      .delete(providerPath('provider-deployments/:providerDeploymentId', 'providerDeployments.delete'), {
        name: 'Delete provider deployment',
        description: 'Permanently deletes a provider deployment.'
      })
      .output(deleteResponsePresenter)
      .do(async ctx => {
        await subspaceProviderDeploymentService.delete({
          instance: ctx.instance,
          providerDeploymentId: ctx.deployment.id
        });

        return deleteResponsePresenter.present({
          id: ctx.deployment.id,
          object: 'provider.deployment'
        });
      })
  }
);
