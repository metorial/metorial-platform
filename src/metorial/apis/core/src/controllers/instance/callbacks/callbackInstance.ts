import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  subspaceCallbackInstanceService,
  subspaceProvisionedTenantAppService,
  subspaceCallbackService
} from '@metorial/module-subspace';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import {
  callbackEventPresenter,
  callbackGithubManifestSetupPresenter,
  callbackInstancePresenter,
  callbackSecretBulkRevocationPresenter,
  callbackSecretConsumptionPresenter,
  callbackSecretMutationPresenter
} from '../../../presenters';
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

  let callback = await subspaceCallbackService.get({
    instance: ctx.instance,
    callbackId: ctx.params.callbackId
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
        let paginator = await subspaceCallbackInstanceService.list({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
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

        return Paginator.present(list, callbackInstance =>
          callbackInstancePresenter.present({ callbackInstance })
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
        let callbackInstance = await subspaceCallbackInstanceService.get({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId
        });

        return callbackInstancePresenter.present({ callbackInstance });
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
        let callbackInstance = await subspaceCallbackInstanceService.attach({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          configId: ctx.body.provider_config_id,
          authConfigId: ctx.body.provider_auth_config_id
        });

        return callbackInstancePresenter.present({ callbackInstance });
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
          subspaceCallbackService
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
            'Creates the initial generated receiver-path secret and an expiring one-time issuance receipt.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackSecretMutationPresenter)
      .do(async ctx => {
        let callbackSecretMutation = await subspaceCallbackService.createReceiverPathSecret({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId,
          organizationActor: ctx.actor!,
          requestId: ctx.requestId,
          requestIp: ctx.context.ip,
          requestUserAgent: ctx.context.ua ?? undefined
        });
        return callbackSecretMutationPresenter.present({ callbackSecretMutation });
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
            'Rotates generated receiver-path material and retains the previous version for a bounded grace period.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          grace_period_seconds: v.optional(
            v.number({
              description:
                'How long the previous secret stays valid after rotation. Zero revokes it immediately.',
              modifiers: [v.integer(), v.minValue(0), v.maxValue(7 * 86_400)]
            })
          )
        })
      )
      .output(callbackSecretMutationPresenter)
      .do(async ctx => {
        let callbackSecretMutation = await subspaceCallbackService.rotateReceiverPathSecret({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId,
          organizationActor: ctx.actor!,
          requestId: ctx.requestId,
          requestIp: ctx.context.ip,
          requestUserAgent: ctx.context.ua ?? undefined,
          graceMs:
            ctx.body.grace_period_seconds === undefined
              ? undefined
              : ctx.body.grace_period_seconds * 1000
        });
        return callbackSecretMutationPresenter.present({ callbackSecretMutation });
      }),

    revokeReceiverPathSecret: dashboardCallbackGroup
      .delete(
        instancePath(
          'callbacks/:callbackId/instances/:callbackInstanceId/security/path-secret/:secretId',
          'callbacks.instances.revokeReceiverPathSecret'
        ),
        {
          name: 'Revoke secure callback URL',
          description: 'Revokes one exact generated receiver-path secret.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackSecretMutationPresenter)
      .do(async ctx => {
        let callbackSecretMutation = await subspaceCallbackService.revokeReceiverPathSecret({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId,
          organizationActor: ctx.actor!,
          requestId: ctx.requestId,
          requestIp: ctx.context.ip,
          requestUserAgent: ctx.context.ua ?? undefined,
          secretId: ctx.params.secretId
        });
        return callbackSecretMutationPresenter.present({ callbackSecretMutation });
      }),

    revokeAllReceiverPathSecrets: dashboardCallbackGroup
      .delete(
        instancePath(
          'callbacks/:callbackId/instances/:callbackInstanceId/security/path-secret',
          'callbacks.instances.revokeAllReceiverPathSecrets'
        ),
        {
          name: 'Revoke all secure callback URLs',
          description:
            'Immediately revokes every active and retiring receiver-path secret for the callback instance.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackSecretBulkRevocationPresenter)
      .do(async ctx => {
        let callbackSecretBulkRevocation =
          await subspaceCallbackService.revokeAllReceiverPathSecrets({
            instance: ctx.instance,
            callbackId: ctx.callback.id,
            callbackInstanceId: ctx.params.callbackInstanceId,
            organizationActor: ctx.actor!,
            requestId: ctx.requestId,
            requestIp: ctx.context.ip,
            requestUserAgent: ctx.context.ua ?? undefined
          });
        return callbackSecretBulkRevocationPresenter.present({ callbackSecretBulkRevocation });
      }),

    consumeReceiverPathSecretReceipt: dashboardCallbackGroup
      .post(
        instancePath(
          'callbacks/:callbackId/instances/:callbackInstanceId/security/path-secret/receipts/:receiptId/consume',
          'callbacks.instances.consumeReceiverPathSecretReceipt'
        ),
        {
          name: 'Reveal a newly generated callback secret once',
          description:
            'Consumes an eligible expiring issuance receipt exactly once. No ordinary plaintext-read endpoint exists.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          receipt_token: v.string({ modifiers: [v.minLength(1), v.maxLength(256)] })
        })
      )
      .output(callbackSecretConsumptionPresenter)
      .do(async ctx => {
        let callbackSecretConsumption =
          await subspaceCallbackService.consumeReceiverPathSecretReceipt({
            instance: ctx.instance,
            callbackId: ctx.callback.id,
            callbackInstanceId: ctx.params.callbackInstanceId,
            organizationActor: ctx.actor!,
            requestId: ctx.requestId,
            requestIp: ctx.context.ip,
            requestUserAgent: ctx.context.ua ?? undefined,
            receiptId: ctx.params.receiptId,
            receiptToken: ctx.body.receipt_token
          });
        return callbackSecretConsumptionPresenter.present({ callbackSecretConsumption });
      }),

    beginGithubManifest: dashboardCallbackGroup
      .post(
        instancePath(
          'callbacks/:callbackId/instances/:callbackInstanceId/security/provisioned-apps/:provisionedTenantAppId/github-manifest',
          'callbacks.instances.beginGithubManifest'
        ),
        {
          name: 'Begin GitHub app manifest setup',
          description:
            'Creates an expiring, authorized GitHub manifest setup redirect for an owned BYO callback app.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackGithubManifestSetupPresenter)
      .do(async ctx => {
        let callbackInstance = await subspaceCallbackInstanceService.get({
          instance: ctx.instance,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.params.callbackInstanceId
        });
        let app = callbackInstance.security.provisionedApps.find(
          candidate => candidate.id === ctx.params.provisionedTenantAppId
        );
        if (
          !app ||
          app.credentialOwnerType !== 'byo' ||
          app.vendor.toLowerCase() !== 'github'
        ) {
          throw new ServiceError(
            badRequestError({
              code: 'github_manifest_setup_unavailable',
              message: 'GitHub manifest setup is unavailable for this callback instance.'
            })
          );
        }
        let setup = await subspaceProvisionedTenantAppService.beginGithubManifest({
          instance: ctx.instance,
          provisionedTenantAppId: app.id,
          expectedGeneration: app.generation
        });
        return callbackGithubManifestSetupPresenter.present({ setup });
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
