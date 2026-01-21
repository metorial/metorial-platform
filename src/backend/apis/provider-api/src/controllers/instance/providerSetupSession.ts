import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderSetupSessionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { setupSessionPresenter, deleteResponsePresenter } from '../../presenters';
import { SubspaceSetupSession } from '../../presenters/types';

export let providerSetupSessionGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerSetupSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerSetupSessionId is required',
        description: 'The providerSetupSessionId path parameter is required.'
      })
    );
  }

  let setupSession = await subspaceProviderSetupSessionService.get({
    instance: ctx.instance,
    providerSetupSessionId: ctx.params.providerSetupSessionId
  });

  return { setupSession };
});

export let providerSetupSessionController = Controller.create(
  {
    name: 'Provider Setup Sessions',
    description: 'Manage OAuth setup sessions for provider authentication.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-setup-sessions', 'providerSetupSessions.list'), {
        name: 'List provider setup sessions',
        description: 'Returns a paginated list of provider setup sessions.'
      })
      .outputList(setupSessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_auth_method_id: v.optional(v.string()),
            status: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderSetupSessionService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerAuthMethodId: ctx.query.provider_auth_method_id,
          status: ctx.query.status
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, setupSession =>
          setupSessionPresenter.present({ setupSession: setupSession as SubspaceSetupSession })
        );
      }),

    get: providerSetupSessionGroup
      .get(providerPath('provider-setup-sessions/:providerSetupSessionId', 'providerSetupSessions.get'), {
        name: 'Get provider setup session',
        description: 'Retrieves a specific provider setup session by ID.'
      })
      .output(setupSessionPresenter)
      .do(async ctx => {
        return setupSessionPresenter.present({ setupSession: ctx.setupSession });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-setup-sessions', 'providerSetupSessions.create'), {
        name: 'Create provider setup session',
        description: 'Creates a new provider setup session for OAuth authentication.'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          providerId: v.string(),
          providerDeploymentId: v.optional(v.string()),
          providerAuthMethodId: v.string(),
          uiMode: v.optional(v.union([v.literal('popup'), v.literal('redirect')])),
          redirectUrl: v.optional(v.string())
        })
      )
      .output(setupSessionPresenter)
      .do(async ctx => {
        let setupSession = await subspaceProviderSetupSessionService.create({
          instance: ctx.instance,
          providerId: ctx.body.providerId,
          providerDeploymentId: ctx.body.providerDeploymentId,
          providerAuthMethodId: ctx.body.providerAuthMethodId,
          name: ctx.body.name,
          description: ctx.body.description,
          uiMode: ctx.body.uiMode,
          redirectUrl: ctx.body.redirectUrl,
          metadata: ctx.body.metadata
        });

        return setupSessionPresenter.present({ setupSession: setupSession as SubspaceSetupSession });
      }),

    update: providerSetupSessionGroup
      .patch(providerPath('provider-setup-sessions/:providerSetupSessionId', 'providerSetupSessions.update'), {
        name: 'Update provider setup session',
        description: 'Updates a specific provider setup session.'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(setupSessionPresenter)
      .do(async ctx => {
        let setupSession = await subspaceProviderSetupSessionService.update({
          instance: ctx.instance,
          providerSetupSessionId: ctx.setupSession.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return setupSessionPresenter.present({ setupSession: setupSession as SubspaceSetupSession });
      }),

    delete: providerSetupSessionGroup
      .delete(providerPath('provider-setup-sessions/:providerSetupSessionId', 'providerSetupSessions.delete'), {
        name: 'Delete provider setup session',
        description: 'Deletes a provider setup session.'
      })
      .output(deleteResponsePresenter)
      .do(async ctx => {
        await subspaceProviderSetupSessionService.delete({
          instance: ctx.instance,
          providerSetupSessionId: ctx.setupSession.id
        });

        return deleteResponsePresenter.present({
          id: ctx.setupSession.id,
          object: 'provider.setup_session'
        });
      })
  }
);
