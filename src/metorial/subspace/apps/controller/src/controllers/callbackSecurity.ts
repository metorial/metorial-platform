import { v } from '@lowerdeck/validation';
import { callbackService } from '@metorial-subspace/module-callback';
import { tenantApp } from './tenant';
import type { CoreCallbackSecurityContext } from './callbackSecurityRpcAuth';

let authenticatedCoreApp = tenantApp.use(async ctx => {
  let auth = (
    ctx as typeof ctx & {
      coreCallbackSecurity?: CoreCallbackSecurityContext;
    }
  ).coreCallbackSecurity;
  if (
    !auth ||
    auth.audience !== 'subspace_callback_security' ||
    auth.serviceActorId !== 'metorial_core'
  ) {
    throw new Error('Authenticated Core callback-security context is required');
  }
  return { coreCallbackSecurity: auth };
});

let callbackSecurityApp = authenticatedCoreApp.use(async ctx => {
  let callbackId = ctx.body.callbackId;
  if (!callbackId) throw new Error('Callback ID is required');
  return {
    callback: await callbackService.getCallbackById({
      tenant: ctx.tenant,
      solution: ctx.solution,
      environment: ctx.environment,
      callbackId
    })
  };
});

let ownerInput = {
  tenantId: v.string(),
  environmentId: v.string(),
  callbackId: v.string(),
  callbackInstanceId: v.string()
};

let trustedRequest = (ctx: { coreCallbackSecurity: CoreCallbackSecurityContext }) => ({
  trustedActorId: ctx.coreCallbackSecurity.trustedActorId,
  requestContext: {
    requestId: ctx.coreCallbackSecurity.sourceRequestId,
    ip: ctx.coreCallbackSecurity.sourceRequestIp,
    ua: ctx.coreCallbackSecurity.sourceRequestUserAgent
  }
});

export let callbackSecurityController = {
  callbackSecurity: callbackSecurityApp.controller({
    createReceiverPathSecret: callbackSecurityApp
      .handler()
      .input(v.object(ownerInput))
      .do(async ctx =>
        callbackService.createReceiverPathSecret({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.input.callbackInstanceId,
          ...trustedRequest(ctx)
        })
      ),

    rotateReceiverPathSecret: callbackSecurityApp
      .handler()
      .input(v.object({ ...ownerInput, graceMs: v.optional(v.number()) }))
      .do(async ctx =>
        callbackService.rotateReceiverPathSecret({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.input.callbackInstanceId,
          graceMs: ctx.input.graceMs,
          ...trustedRequest(ctx)
        })
      ),

    revokeReceiverPathSecret: callbackSecurityApp
      .handler()
      .input(v.object({ ...ownerInput, secretId: v.string() }))
      .do(async ctx =>
        callbackService.revokeReceiverPathSecret({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.input.callbackInstanceId,
          secretId: ctx.input.secretId,
          ...trustedRequest(ctx)
        })
      ),

    revokeAllReceiverPathSecrets: callbackSecurityApp
      .handler()
      .input(v.object(ownerInput))
      .do(async ctx =>
        callbackService.revokeAllReceiverPathSecrets({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.input.callbackInstanceId,
          ...trustedRequest(ctx)
        })
      ),

    consumeReceiverPathSecretReceipt: callbackSecurityApp
      .handler()
      .input(
        v.object({
          ...ownerInput,
          receiptId: v.string(),
          receiptToken: v.string()
        })
      )
      .do(async ctx =>
        callbackService.consumeReceiverPathSecretReceipt({
          tenant: ctx.tenant,
          solution: ctx.solution,
          environment: ctx.environment,
          callbackId: ctx.callback.id,
          callbackInstanceId: ctx.input.callbackInstanceId,
          receiptId: ctx.input.receiptId,
          receiptToken: ctx.input.receiptToken,
          ...trustedRequest(ctx)
        })
      )
  })
};
