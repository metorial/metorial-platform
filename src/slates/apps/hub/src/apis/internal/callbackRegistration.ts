import { v } from '@lowerdeck/validation';
import type { Tenant } from '../../../prisma/generated/client';
import { slateTriggerReceiverPresenter } from '../../presenters';
import {
  slateAuthConfigService,
  slateInstanceService,
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

export let callbackRegistrationController = app.controller({
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

      let receiver = await slateTriggerReceiverService.upsertTriggerReceiverForCallback({
        tenant: ctx.tenant,
        slateInstance,
        authConfig: authConfig ?? null,
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
