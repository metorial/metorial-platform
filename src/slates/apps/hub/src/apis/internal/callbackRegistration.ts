import { v } from '@lowerdeck/validation';
import type { Tenant } from '../../../prisma/generated/client';
import { slateTriggerReceiverPresenter } from '../../presenters';
import {
  slateAuthConfigService,
  slateCallbackConfigService,
  slateInstanceService,
  slateTriggerReceiverSecretService,
  slateTriggerReceiverService
} from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

let resolveAuthConfig = async (tenant: Tenant, authConfigId?: string | null) => {
  if (authConfigId === undefined) return undefined;
  if (authConfigId === null) return null;

  return await slateAuthConfigService.getSlateAuthConfigById({
    tenant,
    id: authConfigId
  });
};

let resolveCallbackConfig = async (tenant: Tenant, callbackConfigId?: string | null) => {
  if (!callbackConfigId) return null;
  return await slateCallbackConfigService.getSlateCallbackConfigById({
    tenant,
    id: callbackConfigId
  });
};

export let callbackRegistrationController = app.controller({
  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string(),
        slateTriggerReceiverId: v.string(),
        expectedOwnerVersion: v.number()
      })
    )
    .do(async ctx => {
      let receiver = await slateTriggerReceiverService.getTriggerReceiverForCallback({
        tenant: ctx.tenant,
        receiverId: ctx.input.slateTriggerReceiverId,
        callbackId: ctx.input.callbackId,
        callbackInstanceId: ctx.input.callbackInstanceId,
        expectedOwnerVersion: ctx.input.expectedOwnerVersion
      });
      return slateTriggerReceiverPresenter(receiver);
    }),

  upsert: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string(),
        expectedSlateTriggerReceiverId: v.nullable(v.string()),
        expectedOwnerVersion: v.number(),
        ownerMutationId: v.string(),
        slateInstanceId: v.string(),
        authConfigId: v.optional(v.nullable(v.string())),
        callbackConfigId: v.optional(v.string()),
        name: v.optional(v.nullable(v.string())),
        description: v.optional(v.nullable(v.string())),
        triggers: v.array(
          v.object({
            triggerId: v.string(),
            eventTypes: v.optional(v.array(v.string())),
            state: v.optional(v.nullable(v.record(v.any()))),
            pollIntervalSeconds: v.optional(v.nullable(v.number()))
          })
        )
      })
    )
    .do(async ctx => {
      let slateInstance = await slateInstanceService.getSlateInstanceById({
        tenant: ctx.tenant,
        id: ctx.input.slateInstanceId
      });
      let authConfig = await resolveAuthConfig(ctx.tenant, ctx.input.authConfigId);
      let callbackConfig = await resolveCallbackConfig(ctx.tenant, ctx.input.callbackConfigId);

      let receiver = await slateTriggerReceiverService.upsertTriggerReceiverForCallback({
        tenant: ctx.tenant,
        slateInstance,
        authConfig: authConfig ?? null,
        callbackConfig,
        input: {
          callbackId: ctx.input.callbackId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          expectedSlateTriggerReceiverId: ctx.input.expectedSlateTriggerReceiverId,
          expectedOwnerVersion: ctx.input.expectedOwnerVersion,
          ownerMutationId: ctx.input.ownerMutationId,
          name: ctx.input.name,
          description: ctx.input.description,
          triggers: ctx.input.triggers
        }
      });

      return slateTriggerReceiverPresenter(receiver);
    }),

  createPathSecret: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string(),
        slateTriggerReceiverId: v.string(),
        expectedOwnerVersion: v.number(),
        ownerMutationId: v.string()
      })
    )
    .do(async ctx => {
      let result = await slateTriggerReceiverSecretService.createInitialPathSecret({
        tenant: ctx.tenant,
        receiverId: ctx.input.slateTriggerReceiverId,
        owner: {
          callbackId: ctx.input.callbackId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          expectedOwnerVersion: ctx.input.expectedOwnerVersion,
          mutationId: ctx.input.ownerMutationId
        }
      });
      return {
        slateTriggerReceiverId: ctx.input.slateTriggerReceiverId,
        callbackOwnerVersion: ctx.input.expectedOwnerVersion,
        ...result
      };
    }),

  rotatePathSecret: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string(),
        slateTriggerReceiverId: v.string(),
        expectedOwnerVersion: v.number(),
        ownerMutationId: v.string()
      })
    )
    .do(async ctx => {
      let result = await slateTriggerReceiverSecretService.rotatePathSecret({
        tenant: ctx.tenant,
        receiverId: ctx.input.slateTriggerReceiverId,
        owner: {
          callbackId: ctx.input.callbackId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          expectedOwnerVersion: ctx.input.expectedOwnerVersion,
          mutationId: ctx.input.ownerMutationId
        }
      });
      return {
        slateTriggerReceiverId: ctx.input.slateTriggerReceiverId,
        callbackOwnerVersion: ctx.input.expectedOwnerVersion,
        ...result
      };
    }),

  revokePathSecrets: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string(),
        slateTriggerReceiverId: v.string(),
        expectedOwnerVersion: v.number(),
        ownerMutationId: v.string()
      })
    )
    .do(async ctx => {
      let result = await slateTriggerReceiverSecretService.revokeAllPathSecrets({
        tenant: ctx.tenant,
        receiverId: ctx.input.slateTriggerReceiverId,
        owner: {
          callbackId: ctx.input.callbackId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          expectedOwnerVersion: ctx.input.expectedOwnerVersion,
          mutationId: ctx.input.ownerMutationId
        }
      });
      return {
        slateTriggerReceiverId: ctx.input.slateTriggerReceiverId,
        callbackOwnerVersion: ctx.input.expectedOwnerVersion,
        ...result
      };
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackId: v.string(),
        callbackInstanceId: v.string(),
        slateTriggerReceiverId: v.string(),
        expectedOwnerVersion: v.number(),
        ownerMutationId: v.string()
      })
    )
    .do(async ctx => {
      let receiver = await slateTriggerReceiverService.deleteTriggerReceiver({
        tenant: ctx.tenant,
        receiverId: ctx.input.slateTriggerReceiverId,
        callbackOwner: {
          callbackId: ctx.input.callbackId,
          callbackInstanceId: ctx.input.callbackInstanceId,
          expectedOwnerVersion: ctx.input.expectedOwnerVersion,
          ownerMutationId: ctx.input.ownerMutationId
        }
      });

      return slateTriggerReceiverPresenter(receiver);
    })
});
