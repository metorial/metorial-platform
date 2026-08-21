import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthConfigService } from '@metorial-subspace/module-auth';
import {
  callbackInstanceService,
  callbackEventService,
  callbackService,
  enrichCallbackInstanceTriggers,
  enrichSingleCallbackInstanceTriggers
} from '@metorial-subspace/module-callback';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import {
  callbackEventPresenter,
  callbackInstancePresenter,
  callbackReceiverPathSecretPresenter
} from '@metorial/presenters';
import { callbackGroup } from './callback';
import {
  CALLBACK_DASHBOARD_TEST_EVENT,
  sendDashboardTestCallbackEvent
} from './callbackInstanceTestEvent';

let dashboardCallbackGroup = instanceGroup.use(isDashboardGroup()).use(async ctx => {
  if (!ctx.params.callbackId) {
    throw new ServiceError(
      badRequestError({
        message: 'callbackId is required',
        description: 'The callbackId path parameter is required.'
      })
    );
  }

  let callback = await callbackService.getCallbackById({
    instance: ctx.instance,
    callbackId: ctx.params.callbackId,
    allowDeleted: false
  });

  return { callback };
});

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
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by callback instance ID(s)'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['attached', 'detached']),
                v.array(v.enumOf(['attached', 'detached']))
              ]),
              {
                description: 'Filter by callback instance status'
              }
            ),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider config ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            }),
            created_at: dateFilterValidator('callback instance creation time'),
            updated_at: dateFilterValidator('callback instance last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await callbackInstanceService.list({
          instance: ctx.instance,
          callbackIds: [ctx.callback.id],
          ids: normalizeArrayParam(ctx.query.id),
          status: normalizeArrayParam(ctx.query.status) as
            | ('attached' | 'detached')[]
            | undefined,
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);
        let receivers = await enrichCallbackInstanceTriggers(
          ctx.instance,
          ctx.callback,
          list.items
        );

        return Paginator.present(list, callbackInstance =>
          callbackInstancePresenter.present({
            callbackInstance,
            receiver: receivers.get(callbackInstance.id)
          })
        );
      }),

    get: callbackGroup
      .get(
        instancePath(
          'callbacks/:callbackId/instances/:callbackInstanceId',
          'callbacks.instances.get'
        ),
        {
          name: 'Get callback instance',
          description: 'Retrieves a specific callback instance by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackInstancePresenter)
      .do(async ctx => {
        let callbackInstance = await callbackInstanceService.get({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId
        });
        let receiver = await enrichSingleCallbackInstanceTriggers(
          ctx.instance,
          ctx.callback,
          callbackInstance
        );

        return callbackInstancePresenter.present({ callbackInstance, receiver });
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
          provider_config_id: v.string({
            description: 'Provider config to attach to the callback instance',
            examples: ['pcf_7dEfGhJkLmNpQrSt']
          }),
          provider_auth_config_id: v.optional(
            v.string({
              description: 'Optional provider auth config to attach to the callback instance',
              examples: ['pac_8pQrStUvWxYzAbCd']
            })
          )
        })
      )
      .output(callbackInstancePresenter)
      .do(async ctx => {
        let config = await providerConfigService.getProviderConfigById({
          instance: ctx.instance,
          providerConfigId: ctx.body.provider_config_id
        });
        let authConfig = ctx.body.provider_auth_config_id
          ? await providerAuthConfigService.getProviderAuthConfigById({
              instance: ctx.instance,
              providerAuthConfigId: ctx.body.provider_auth_config_id
            })
          : undefined;
        let callbackInstance = await callbackInstanceService.attach({
          instance: ctx.instance,
          callback: ctx.callback,
          config,
          authConfig
        });
        let receiver = await enrichSingleCallbackInstanceTriggers(
          ctx.instance,
          ctx.callback,
          callbackInstance
        );

        return callbackInstancePresenter.present({ callbackInstance, receiver });
      }),

    sendTestEvent: dashboardCallbackGroup
      .post(
        instancePath(
          CALLBACK_DASHBOARD_TEST_EVENT.route,
          CALLBACK_DASHBOARD_TEST_EVENT.sdkPath
        ),
        {
          name: 'Send callback test event',
          description:
            'Queues an authenticated dashboard synthetic event for a callback instance.',
          confidential: CALLBACK_DASHBOARD_TEST_EVENT.confidential
        }
      )
      .use(checkAccess({ possibleScopes: [CALLBACK_DASHBOARD_TEST_EVENT.scope] }))
      .body(
        'default',
        v.object({
          event_type: v.string({
            description: 'Synthetic callback event type',
            examples: ['dashboard.test']
          }),
          payload: v.record(v.any(), {
            description: 'Synthetic callback event payload'
          })
        })
      )
      .output(callbackEventPresenter)
      .do(async ctx => {
        let callbackEvent = await sendDashboardTestCallbackEvent(
          {
            instance: ctx.instance,
            callbackId: ctx.callback.id,
            callbackInstanceId: ctx.params.callbackInstanceId,
            eventType: ctx.body.event_type,
            payload: ctx.body.payload
          },
          callbackEventService
        );

        return callbackEventPresenter.present({ callbackEvent });
      }),

    createReceiverPathSecret: dashboardCallbackGroup
      .post(
        instancePath(
          'callbacks/:callbackId/instances/:callbackInstanceId/security/path-secret',
          'callbacks.instances.createReceiverPathSecret'
        ),
        {
          name: 'Create secure callback URL',
          description:
            'Creates the initial receiver path secret and returns its plaintext once.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackReceiverPathSecretPresenter)
      .do(async ctx => {
        let callbackInstance = await callbackInstanceService.get({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId
        });
        let receiverPathSecret = await callbackInstanceService.createReceiverPathSecret({
          instance: ctx.instance,
          callback: ctx.callback,
          callbackInstance
        });

        return callbackReceiverPathSecretPresenter.present({ receiverPathSecret });
      }),

    rotateReceiverPathSecret: dashboardCallbackGroup
      .post(
        instancePath(
          'callbacks/:callbackId/instances/:callbackInstanceId/security/path-secret/rotate',
          'callbacks.instances.rotateReceiverPathSecret'
        ),
        {
          name: 'Rotate secure callback URL',
          description:
            'Immediately rotates the receiver path secret and returns its new plaintext once.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackReceiverPathSecretPresenter)
      .do(async ctx => {
        let callbackInstance = await callbackInstanceService.get({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId
        });
        let receiverPathSecret = await callbackInstanceService.rotateReceiverPathSecret({
          instance: ctx.instance,
          callback: ctx.callback,
          callbackInstance
        });

        return callbackReceiverPathSecretPresenter.present({ receiverPathSecret });
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
        let callbackInstance = await callbackInstanceService.get({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId
        });
        callbackInstance = await callbackInstanceService.detach({
          instance: ctx.instance,
          callbackInstance
        });
        let receiver = await enrichSingleCallbackInstanceTriggers(
          ctx.instance,
          ctx.callback,
          callbackInstance
        );

        return callbackInstancePresenter.present({ callbackInstance, receiver });
      })
  }
);
