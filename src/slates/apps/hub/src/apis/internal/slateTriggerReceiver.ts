import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { Tenant } from '../../../prisma/generated/client';
import { slateTriggerReceiverPresenter } from '../../presenters';
import {
  slateAuthConfigService,
  slateInstanceService,
  slateTriggerReceiverSecretService,
  slateTriggerReceiverService,
  slateTriggerRegistrationLifecycleService
} from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

const resolveAuthConfig = async (tenant: Tenant, authConfigId?: string | null) => {
  if (authConfigId === undefined) return undefined;
  if (authConfigId === null) return null;

  return await slateAuthConfigService.getSlateAuthConfigById({
    tenant,
    id: authConfigId
  });
};

export let slateTriggerReceiverApp = tenantApp.use(async ctx => {
  let slateTriggerReceiverId = ctx.body.slateTriggerReceiverId;
  if (!slateTriggerReceiverId) throw new Error('Trigger receiver ID is required');

  let receiver = await slateTriggerReceiverService.getTriggerReceiverById({
    tenant: ctx.tenant,
    id: slateTriggerReceiverId
  });

  return { receiver };
});

let deniedLegacyTenantSecretApp = tenantApp.use(async (): Promise<{}> => {
  throw new Error('Secret lifecycle calls require authenticated service RPC');
});
let deniedLegacyReceiverSecretApp = slateTriggerReceiverApp.use(async (): Promise<{}> => {
  throw new Error('Secret lifecycle calls require authenticated service RPC');
});
let deniedLegacyProvisionedProjectionApp = app.use(async (): Promise<{}> => {
  throw new Error('Provisioned-app projections require authenticated service RPC');
});

export let slateTriggerReceiverController = app.controller({
  projectProvisionedAppRoute: deniedLegacyProvisionedProjectionApp
    .handler()
    .input(v.record(v.any()))
    .do(async () => {
      throw new Error('Provisioned-app projections require authenticated service RPC');
    }),
  projectProvisionedTenantApp: deniedLegacyProvisionedProjectionApp
    .handler()
    .input(v.record(v.any()))
    .do(async () => {
      throw new Error('Provisioned-app projections require authenticated service RPC');
    }),
  validateProvisionedTenantCredentialSecret: deniedLegacyProvisionedProjectionApp
    .handler()
    .input(v.record(v.any()))
    .do(async () => {
      throw new Error(
        'Provisioned-app credential validation requires authenticated service RPC'
      );
    }),
  createOrRotateProvisionedTenantCredentialSecret: deniedLegacyProvisionedProjectionApp
    .handler()
    .input(v.record(v.any()))
    .do(async () => {
      throw new Error('Provisioned-app credential writes require authenticated service RPC');
    }),
  revokeProvisionedTenantCredentialSecret: deniedLegacyProvisionedProjectionApp
    .handler()
    .input(v.record(v.any()))
    .do(async () => {
      throw new Error('Provisioned-app credential writes require authenticated service RPC');
    }),
  upsertInstanceConfigSecret: deniedLegacyTenantSecretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateInstanceConfigId: v.string(),
        key: v.string(),
        value: v.string(),
        trustedActorId: v.string(),
        requestId: v.string()
      })
    )
    .do(async ctx => {
      let result = await slateTriggerReceiverSecretService.upsertInstanceConfigSecret({
        tenant: ctx.tenant,
        instanceConfigId: ctx.input.slateInstanceConfigId,
        key: ctx.input.key,
        plaintext: ctx.input.value,
        actor: { actorId: ctx.input.trustedActorId, requestId: ctx.input.requestId }
      });
      return {
        secret: {
          id: result.secret.id,
          secretVersion: result.secret.secretVersion,
          status: result.secret.status
        },
        marker: result.marker,
        auditCorrelationId: result.auditCorrelationId
      };
    }),

  revokeInstanceConfigSecret: deniedLegacyTenantSecretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateInstanceConfigId: v.string(),
        key: v.string(),
        trustedActorId: v.string(),
        requestId: v.string()
      })
    )
    .do(
      async ctx =>
        await slateTriggerReceiverSecretService.revokeInstanceConfigSecret({
          tenant: ctx.tenant,
          instanceConfigId: ctx.input.slateInstanceConfigId,
          key: ctx.input.key,
          actor: { actorId: ctx.input.trustedActorId, requestId: ctx.input.requestId }
        })
    ),

  createInitialPathSecret: deniedLegacyReceiverSecretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string(),
        trustedActorId: v.string(),
        requestId: v.string()
      })
    )
    .do(async ctx => {
      let result = await slateTriggerReceiverSecretService.createInitialPathSecret({
        tenant: ctx.tenant,
        receiverId: ctx.receiver.id,
        actor: { actorId: ctx.input.trustedActorId, requestId: ctx.input.requestId }
      });
      return {
        secret: {
          id: result.secret.id,
          secretVersion: result.secret.secretVersion,
          status: result.secret.status,
          validFrom: result.secret.validFrom
        },
        receipt: result.receipt,
        auditCorrelationId: result.auditCorrelationId
      };
    }),

  rotatePathSecret: deniedLegacyReceiverSecretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string(),
        trustedActorId: v.string(),
        requestId: v.string(),
        graceMs: v.optional(v.number())
      })
    )
    .do(async ctx => {
      let result = await slateTriggerReceiverSecretService.rotatePathSecret({
        tenant: ctx.tenant,
        receiverId: ctx.receiver.id,
        actor: { actorId: ctx.input.trustedActorId, requestId: ctx.input.requestId },
        graceMs: ctx.input.graceMs
      });
      return {
        secret: {
          id: result.secret.id,
          secretVersion: result.secret.secretVersion,
          status: result.secret.status,
          validFrom: result.secret.validFrom
        },
        receipt: result.receipt,
        auditCorrelationId: result.auditCorrelationId
      };
    }),

  revokePathSecret: deniedLegacyReceiverSecretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string(),
        secretId: v.string(),
        trustedActorId: v.string(),
        requestId: v.string()
      })
    )
    .do(async ctx => {
      let result = await slateTriggerReceiverSecretService.revokePathSecret({
        tenant: ctx.tenant,
        receiverId: ctx.receiver.id,
        secretId: ctx.input.secretId,
        actor: { actorId: ctx.input.trustedActorId, requestId: ctx.input.requestId }
      });
      return {
        secret: {
          id: result.secret.id,
          secretVersion: result.secret.secretVersion,
          status: result.secret.status
        },
        auditCorrelationId: result.auditCorrelationId
      };
    }),

  upsertBoundVendorSecret: deniedLegacyReceiverSecretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string(),
        receiverTriggerId: v.string(),
        specHash: v.string(),
        sourceBindingType: v.enumOf([
          'registration',
          'provider_config',
          'provisioned_app',
          'generated'
        ]),
        sourceBindingId: v.string(),
        name: v.string(),
        kind: v.string(),
        encoding: v.string(),
        value: v.string(),
        trustedActorId: v.string(),
        requestId: v.string()
      })
    )
    .do(async () => {
      throw new Error('Secret lifecycle calls require authenticated service RPC');
    }),

  consumePathSecretReceipt: deniedLegacyReceiverSecretApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string(),
        receiptId: v.string(),
        receiptToken: v.string(),
        trustedActorId: v.string(),
        requestId: v.string()
      })
    )
    .do(
      async ctx =>
        await slateTriggerReceiverSecretService.consumePathReceipt({
          callbackReceiverOwner: {
            tenantId: ctx.tenant.id,
            receiverId: ctx.receiver.id,
            callbackId: ctx.receiver.callbackId!,
            callbackInstanceId: ctx.receiver.callbackInstanceId!,
            receiverAuthorityVersion: ctx.receiver.callbackOwnerVersion
          },
          receiptId: ctx.input.receiptId,
          token: ctx.input.receiptToken,
          actor: { actorId: ctx.input.trustedActorId, requestId: ctx.input.requestId }
        })
    ),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateIds: v.optional(v.array(v.string())),
          slateInstanceIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateTriggerReceiverService.listTriggerReceivers({
        tenant: ctx.tenant,
        slateIds: ctx.input.slateIds,
        slateInstanceIds: ctx.input.slateInstanceIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateTriggerReceiverPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateInstanceId: v.string(),
          authConfigId: v.optional(v.string()),
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          eventTypes: v.optional(v.array(v.string())),
          triggers: v.array(
            v.object({
              triggerId: v.string(),
              state: v.optional(v.nullable(v.record(v.any()))),
              pollIntervalSeconds: v.optional(v.nullable(v.number()))
            })
          )
        })
      )
    )
    .do(async ctx => {
      let slateInstance = await slateInstanceService.getSlateInstanceById({
        tenant: ctx.tenant,
        id: ctx.input.slateInstanceId
      });
      let authConfig = ctx.input.authConfigId
        ? await slateAuthConfigService.getSlateAuthConfigById({
            tenant: ctx.tenant,
            id: ctx.input.authConfigId
          })
        : null;

      let receiver = await slateTriggerReceiverService.createTriggerReceiver({
        tenant: ctx.tenant,
        slateInstance,
        authConfig,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          eventTypes: ctx.input.eventTypes,
          triggers: ctx.input.triggers
        }
      });

      return slateTriggerReceiverPresenter(receiver);
    }),

  get: slateTriggerReceiverApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string()
      })
    )
    .do(async ctx => slateTriggerReceiverPresenter(ctx.receiver)),

  renewRegistration: slateTriggerReceiverApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string(),
        receiverTriggerId: v.string()
      })
    )
    .do(async ctx => {
      if (!ctx.receiver.triggers.some(trigger => trigger.id === ctx.input.receiverTriggerId)) {
        throw new Error('Receiver trigger does not belong to this receiver');
      }
      return await slateTriggerReceiverService.renewWebhookRegistration({
        tenant: ctx.tenant,
        receiverTriggerId: ctx.input.receiverTriggerId
      });
    }),

  update: slateTriggerReceiverApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string(),
        authConfigId: v.optional(v.nullable(v.string())),
        name: v.optional(v.nullable(v.string())),
        description: v.optional(v.nullable(v.string())),
        eventTypes: v.optional(v.array(v.string())),
        triggers: v.optional(
          v.array(
            v.object({
              triggerId: v.string(),
              state: v.optional(v.nullable(v.record(v.any()))),
              pollIntervalSeconds: v.optional(v.nullable(v.number()))
            })
          )
        )
      })
    )
    .do(async ctx => {
      let authConfig = await resolveAuthConfig(ctx.tenant, ctx.input.authConfigId);
      let receiver = await slateTriggerReceiverService.updateTriggerReceiver({
        tenant: ctx.tenant,
        receiverId: ctx.input.slateTriggerReceiverId,
        input: {
          authConfig,
          name: ctx.input.name,
          description: ctx.input.description,
          eventTypes: ctx.input.eventTypes,
          triggers: ctx.input.triggers
        }
      });

      return slateTriggerReceiverPresenter(receiver);
    }),

  delete: slateTriggerReceiverApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverId: v.string()
      })
    )
    .do(async ctx => {
      let receiver = await slateTriggerReceiverService.deleteTriggerReceiver({
        tenant: ctx.tenant,
        receiverId: ctx.input.slateTriggerReceiverId
      });

      return slateTriggerReceiverPresenter(receiver);
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerReceiverIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let receivers = await Promise.all(
        ctx.input.slateTriggerReceiverIds.map(id =>
          slateTriggerReceiverService.getTriggerReceiverById({
            tenant: ctx.tenant,
            id
          })
        )
      );

      return receivers.map(slateTriggerReceiverPresenter);
    })
});
