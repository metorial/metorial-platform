import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceCallbackInstanceService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { callbackGroup } from './callback';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { callbackInstancePresenter } from '../../presenters';

export let callbackInstanceController = Controller.create(
  {
    name: 'Callback Instances',
    description:
      'Attach or detach callback instances for a deployment/config/auth-config combination.'
  },
  {
    list: callbackGroup
      .get(instancePath('callbacks/:callbackId/instances', 'callbacks.instances.list'), {
        name: 'List callback instances',
        description: 'Returns a paginated list of callback instances.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackInstancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCallbackInstanceService.list({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          ids: normalizeArrayParam(ctx.query.id),
          status: normalizeArrayParam(ctx.query.status) as
            | ('attached' | 'detached')[]
            | undefined,
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, callbackInstance =>
          callbackInstancePresenter.present({ callbackInstance })
        );
      }),

    create: callbackGroup
      .post(instancePath('callbacks/:callbackId/instances', 'callbacks.instances.create'), {
        name: 'Create callback instance',
        description: 'Attaches a callback to a config and optional auth config.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          provider_config_id: v.string(),
          provider_auth_config_id: v.optional(v.string())
        })
      )
      .output(callbackInstancePresenter)
      .do(async ctx => {
        let callbackInstance = await subspaceCallbackInstanceService.attach({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          configId: ctx.body.provider_config_id,
          authConfigId: ctx.body.provider_auth_config_id
        });

        return callbackInstancePresenter.present({ callbackInstance });
      }),

    delete: callbackGroup
      .delete(
        instancePath(
          'callbacks/:callbackId/instances/:callbackInstanceId',
          'callbacks.instances.delete'
        ),
        {
          name: 'Delete callback instance',
          description: 'Detaches a callback instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackInstancePresenter)
      .do(async ctx => {
        let callbackInstance = await subspaceCallbackInstanceService.detach({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId
        });

        return callbackInstancePresenter.present({ callbackInstance });
      })
  }
);
