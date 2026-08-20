import { Group } from '@lowerdeck/rpc-server';
import { v } from '@lowerdeck/validation';
import { db } from '../../db';
import { env } from '../../env';
import {
  attestWebhookCaptureConformanceReport,
  WEBHOOK_CAPTURE_CONFORMANCE_CASES,
  type UnsignedWebhookCaptureConformanceReport
} from '../../lib/webhookRequestCapture';
import {
  getSlateProvisionedProjectionState,
  projectSlateProvisionedAppRoute,
  projectSlateProvisionedTenantApp,
  SecretIssuanceReceiptDeniedError,
  validateProvisionedTenantCredentialSecret,
  slateTriggerReceiverSecretService,
  slateTriggerWebhookRequestService
} from '../../services';
import { slateAuthHandlerService } from '../../services/slateInstanceAuthHandler';
import { authenticatedScopedGrantRedemption } from '../../services/slateTriggerReceiverSecurity';
import type { SlatesScopedInvocationGrantEnvelope } from '../../lib/invocation/types';
import { getTriggerWebhookBaseUrl } from '../../lib/triggerWebhook';

export type SlatesHubSecretAuthContext = {
  serviceActorId: string;
  deploymentId?: string;
  runtimeIdentityId?: string;
  runtimeIdentityGeneration?: number;
};
export let authenticatedSecretApp = new Group<SlatesHubSecretAuthContext>();

let actor = (ctx: SlatesHubSecretAuthContext & { requestId: string }) => ({
  actorId: ctx.serviceActorId,
  requestId: ctx.requestId
});

type CallbackReceiverAuditInput = {
  tenantId: string;
  receiverId: string;
  callbackId: string;
  callbackInstanceId: string;
  receiverAuthorityVersion: number;
  trustedActorId: string;
  requestId: string;
  requestIp?: string;
  requestUserAgent?: string;
};

let callbackActor = (
  ctx: SlatesHubSecretAuthContext,
  input: Pick<
    CallbackReceiverAuditInput,
    'trustedActorId' | 'requestId' | 'requestIp' | 'requestUserAgent'
  >
) => {
  if (ctx.serviceActorId !== 'subspace_callback_security') {
    throw new Error('Callback secret lifecycle requires the trusted Subspace service actor');
  }
  return {
    actorId: input.trustedActorId,
    requestId: input.requestId,
    requestIp: input.requestIp,
    requestUserAgent: input.requestUserAgent
  };
};

let callbackReceiverOwnerFromInput = (input: CallbackReceiverAuditInput) => ({
  tenantId: input.tenantId,
  receiverId: input.receiverId,
  callbackId: input.callbackId,
  callbackInstanceId: input.callbackInstanceId,
  receiverAuthorityVersion: input.receiverAuthorityVersion
});

let resolveReceiverOwner = async (receiverId: string) => {
  let receiver = await db.slateTriggerReceiver.findUnique({
    where: { id: receiverId },
    include: { tenant: true }
  });
  if (!receiver) throw new Error('Authenticated receiver owner was not found');
  return receiver;
};

let resolveCallbackReceiverOwner = async (input: CallbackReceiverAuditInput) => {
  let receiver = await resolveReceiverOwner(input.receiverId);
  if (
    receiver.tenant.id !== input.tenantId ||
    receiver.callbackId !== input.callbackId ||
    receiver.callbackInstanceId !== input.callbackInstanceId ||
    receiver.callbackOwnerVersion !== input.receiverAuthorityVersion ||
    receiver.status !== 'active' ||
    receiver.tombstonedAt !== null
  ) {
    throw new Error('Authenticated callback receiver owner binding is stale or invalid');
  }
  return receiver;
};

let resolveConfigOwner = async (instanceConfigId: string) => {
  let config = await db.slateInstanceConfig.findUnique({
    where: { id: instanceConfigId },
    include: { tenant: true, instance: true }
  });
  if (!config || config.instance.tenantOid !== config.tenantOid) {
    throw new Error('Authenticated config owner binding is invalid');
  }
  return config;
};

let presentTriggerSecretMutation = (result: {
  secret: {
    id: string;
    status: string;
    secretVersion: number;
    encryptionKeyVersion: number;
    aadVersion: number;
    validFrom: Date;
    validUntil: Date | null;
  };
  auditCorrelationId?: string | null;
}) => ({
  secret: {
    id: result.secret.id,
    status: result.secret.status,
    secretVersion: result.secret.secretVersion,
    encryptionKeyVersion: result.secret.encryptionKeyVersion,
    aadVersion: result.secret.aadVersion,
    validFrom: result.secret.validFrom,
    validUntil: result.secret.validUntil
  },
  auditCorrelationId: result.auditCorrelationId ?? null
});

type AuthenticatedRequestContext = SlatesHubSecretAuthContext & { requestId: string };
export let authenticatedTriggerSecretLifecycle = {
  generate: async (
    ctx: AuthenticatedRequestContext,
    input: { receiverTriggerId: string; name: string }
  ) =>
    presentTriggerSecretMutation(
      await slateTriggerReceiverSecretService.generateDeclaredTriggerSecret({
        ...input,
        actor: actor(ctx)
      })
    ),
  import: async (
    ctx: AuthenticatedRequestContext,
    input: { receiverTriggerId: string; name: string; value: string }
  ) =>
    presentTriggerSecretMutation(
      await slateTriggerReceiverSecretService.importDeclaredTriggerSecret({
        receiverTriggerId: input.receiverTriggerId,
        name: input.name,
        plaintext: input.value,
        actor: actor(ctx)
      })
    ),
  rotateImported: async (
    ctx: AuthenticatedRequestContext,
    input: { receiverTriggerId: string; name: string; value: string }
  ) =>
    presentTriggerSecretMutation(
      await slateTriggerReceiverSecretService.rotateImportedDeclaredTriggerSecret({
        receiverTriggerId: input.receiverTriggerId,
        name: input.name,
        plaintext: input.value,
        actor: actor(ctx)
      })
    ),
  resolveMetadata: async (input: { receiverTriggerId: string; name: string }) =>
    await slateTriggerReceiverSecretService.resolveDeclaredTriggerSecretMetadata(input),
  reencrypt: async (
    ctx: AuthenticatedRequestContext,
    input: { receiverTriggerId: string; name: string; secretId: string }
  ) =>
    presentTriggerSecretMutation(
      await slateTriggerReceiverSecretService.reencryptDeclaredTriggerSecret({
        ...input,
        actor: actor(ctx)
      })
    ),
  revoke: async (
    ctx: AuthenticatedRequestContext,
    input: { receiverTriggerId: string; name: string; secretId: string }
  ) =>
    presentTriggerSecretMutation(
      await slateTriggerReceiverSecretService.revokeDeclaredTriggerSecret({
        ...input,
        actor: actor(ctx)
      })
    )
};

export let authenticatedInstanceConfigSecretLifecycle = {
  importDeclared: async (
    ctx: AuthenticatedRequestContext,
    input: { slateInstanceConfigId: string; path: string; value: string }
  ) => {
    let config = await resolveConfigOwner(input.slateInstanceConfigId);
    let result = await slateTriggerReceiverSecretService.importDeclaredInstanceConfigSecret({
      tenant: config.tenant,
      instanceConfigId: config.id,
      key: input.path,
      plaintext: input.value,
      actor: actor(ctx)
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
  }
};

export let authenticatedReceiverSecretLifecycle = {
  createPath: async (ctx: AuthenticatedRequestContext, input: CallbackReceiverAuditInput) => {
    let receiver = await resolveCallbackReceiverOwner(input);
    let result = await slateTriggerReceiverSecretService.createInitialPathSecret({
      tenant: receiver.tenant,
      receiverId: receiver.id,
      actor: callbackActor(ctx, input)
    });
    return {
      ...presentTriggerSecretMutation(result),
      secretIssuanceReceipt: result.receipt
    };
  },
  rotatePath: async (
    ctx: AuthenticatedRequestContext,
    input: CallbackReceiverAuditInput & { graceMs?: number }
  ) => {
    let receiver = await resolveCallbackReceiverOwner(input);
    let result = await slateTriggerReceiverSecretService.rotatePathSecret({
      tenant: receiver.tenant,
      receiverId: receiver.id,
      actor: callbackActor(ctx, input),
      graceMs: input.graceMs
    });
    return {
      ...presentTriggerSecretMutation(result),
      secretIssuanceReceipt: result.receipt,
      graceExpiresAt: result.graceExpiresAt
    };
  },
  revokePath: async (
    ctx: AuthenticatedRequestContext,
    input: CallbackReceiverAuditInput & { secretId: string }
  ) => {
    let receiver = await resolveCallbackReceiverOwner(input);
    return presentTriggerSecretMutation(
      await slateTriggerReceiverSecretService.revokePathSecret({
        tenant: receiver.tenant,
        receiverId: receiver.id,
        secretId: input.secretId,
        actor: callbackActor(ctx, input)
      })
    );
  },
  revokeAllPath: async (
    ctx: AuthenticatedRequestContext,
    input: CallbackReceiverAuditInput
  ) => {
    let receiver = await resolveCallbackReceiverOwner(input);
    let result = await slateTriggerReceiverSecretService.revokeAllPathSecrets({
      tenant: receiver.tenant,
      receiverId: receiver.id,
      actor: callbackActor(ctx, input)
    });
    return {
      secrets: result.secrets.map(
        secret => presentTriggerSecretMutation({ secret }).secret
      ),
      revokedCount: result.revokedCount,
      auditCorrelationId: result.auditCorrelationId
    };
  },
  consumePathReceipt: async (
    ctx: AuthenticatedRequestContext,
    input: CallbackReceiverAuditInput & { receiptId: string; receiptToken: string }
  ) => {
    let auditActor = callbackActor(ctx, input);
    try {
      let result = await slateTriggerReceiverSecretService.consumePathReceipt({
        callbackReceiverOwner: callbackReceiverOwnerFromInput(input),
        receiptId: input.receiptId,
        token: input.receiptToken,
        actor: auditActor
      });
      return { outcome: 'consumed' as const, ...result };
    } catch (error) {
      if (error instanceof SecretIssuanceReceiptDeniedError) {
        return {
          outcome: 'denied' as const,
          auditCorrelationId: error.auditCorrelationId
        };
      }
      throw error;
    }
  },
  getAudit: async (
    ctx: AuthenticatedRequestContext,
    input: CallbackReceiverAuditInput & { auditCorrelationId: string }
  ) => {
    let auditActor = callbackActor(ctx, input);
    return await slateTriggerReceiverSecretService.getReceiverSecretAuditByCorrelation({
      receiverId: input.receiverId,
      tenantId: input.tenantId,
      callbackId: input.callbackId,
      callbackInstanceId: input.callbackInstanceId,
      receiverAuthorityVersion: input.receiverAuthorityVersion,
      actor: auditActor,
      auditCorrelationId: input.auditCorrelationId
    });
  }
};

export let authenticatedProvisionedTenantSecretLifecycle = {
  createOrRotate: async (
    ctx: AuthenticatedRequestContext,
    input: { provisionedTenantAppId: string; importedValue: string }
  ) => {
    let result =
      await slateTriggerReceiverSecretService.createOrRotateProvisionedTenantAppSecret({
        provisionedTenantAppId: input.provisionedTenantAppId,
        plaintext: input.importedValue,
        actor: actor(ctx)
      });
    return {
      ...presentTriggerSecretMutation(result),
      idempotent: result.idempotent,
      secretIssuanceReceipt: null as null
    };
  },
  revoke: async (
    ctx: AuthenticatedRequestContext,
    input: { provisionedTenantAppId: string }
  ) => {
    let result = await slateTriggerReceiverSecretService.revokeProvisionedTenantAppSecret({
      provisionedTenantAppId: input.provisionedTenantAppId,
      actor: actor(ctx)
    });
    return {
      ...presentTriggerSecretMutation(result),
      idempotent: result.idempotent,
      secretIssuanceReceipt: null as null
    };
  }
};

export let authenticatedWebhookCaptureConformance = {
  getCapture: async (input: { webhookRequestId: string }) =>
    await slateTriggerWebhookRequestService.loadAuthenticatedConformancePayload(input),
  attest: async (input: UnsignedWebhookCaptureConformanceReport) => {
    if (
      input.version !== 1 ||
      input.rawHeaderSource !== 'native' ||
      WEBHOOK_CAPTURE_CONFORMANCE_CASES.some(
        name => input.cases[name] !== 'passed' && input.cases[name] !== 'failed'
      )
    ) {
      throw new Error('Webhook capture conformance report is invalid');
    }
    let token = env.slates.SLATES_HUB_SECRET_RPC_TOKEN;
    if (!token) throw new Error('Authenticated secret RPC token is not configured');
    return attestWebhookCaptureConformanceReport(input, token);
  }
};

let callbackReceiverAuditFields = {
  tenantId: v.string(),
  receiverId: v.string(),
  callbackId: v.string(),
  callbackInstanceId: v.string(),
  receiverAuthorityVersion: v.number(),
  trustedActorId: v.string(),
  requestId: v.string(),
  requestIp: v.optional(v.string()),
  requestUserAgent: v.optional(v.string())
};

export let authenticatedToolInvocationGrantRedemption = async (d: {
  caller: {
    deploymentId: string;
    runtimeIdentityId: string;
    runtimeIdentityGeneration: number;
    hubInvocationId: string;
  };
  authenticatedContext: SlatesHubSecretAuthContext;
  envelope: SlatesScopedInvocationGrantEnvelope;
  expected: {
    requestId: string;
    operation: 'tool_invoke';
    actionId: string;
    secretNames: readonly string[];
  };
}) => {
  if (
    d.authenticatedContext.serviceActorId !== 'slates_function_bay_runtime' ||
    d.authenticatedContext.deploymentId !== d.caller.deploymentId ||
    d.authenticatedContext.runtimeIdentityId !== d.caller.runtimeIdentityId ||
    d.authenticatedContext.runtimeIdentityGeneration !== d.caller.runtimeIdentityGeneration
  ) {
    throw new Error('Scoped invocation runtime caller identity is invalid');
  }
  let bindings = await authenticatedScopedGrantRedemption.redeem({
    envelope: d.envelope,
    expected: {
      requestId: d.expected.requestId,
      operation: d.expected.operation,
      actionId: d.expected.actionId,
      deploymentId: d.caller.deploymentId,
      runtimeIdentityId: d.caller.runtimeIdentityId,
      runtimeIdentityGeneration: d.caller.runtimeIdentityGeneration,
      hubInvocationId: d.caller.hubInvocationId
    }
  });
  if (bindings.operation !== 'tool_invoke') {
    throw new Error('Scoped invocation grant operation is invalid');
  }
  let instance = await db.slateInstance.findUnique({
    where: { id: bindings.slateInstanceId },
    include: { tenant: true, currentConfig: { include: { schema: true } } }
  });
  let currentConfig = instance?.currentConfig;
  if (
    !instance ||
    !currentConfig ||
    instance.tenant.id !== bindings.tenantId ||
    currentConfig.schema.version !== bindings.configSchemaVersion ||
    currentConfig.schema.descriptorHash !== bindings.configSchemaHash
  ) {
    throw new Error('Scoped invocation config owner or schema binding is stale');
  }
  let action = await db.slateAction.findFirst({
    where: { key: bindings.actionId, slateOid: instance.slateOid },
    select: { id: true }
  });
  if (!action) throw new Error('Scoped invocation action binding is stale');

  let secrets: Record<string, { value: string; version: number }> = {};
  for (let [name, version] of Object.entries(bindings.configSecretVersions)) {
    if (!name.startsWith('config:')) throw new Error('Scoped config binding is invalid');
    let key = name.slice('config:'.length);
    let resolved = await slateTriggerReceiverSecretService.resolveInstanceConfigSecret({
      tenant: instance.tenant,
      instanceConfigId: currentConfig.id,
      key
    });
    let active = resolved.find(
      item => item.secret.status === 'active' && item.secret.secretVersion === version
    );
    if (!active) throw new Error(`Scoped config binding is stale: ${key}`);
    secrets[name] = { value: JSON.stringify(active.plaintext), version };
  }

  if (bindings.authConfigId) {
    let auth = await slateAuthHandlerService.getSlateInstanceAuth({
      tenant: instance.tenant,
      slateInstance: instance,
      authConfigId: bindings.authConfigId,
      minExpirationBuffer: 0
    });
    let actualVersion = Math.max(1, auth.authConfig.updatedAt.getTime());
    for (let [name, version] of Object.entries(bindings.authSecretVersions)) {
      if (!name.startsWith('auth:') || version !== actualVersion) {
        throw new Error('Scoped authentication binding is stale');
      }
      let key = name.slice('auth:'.length);
      if (key !== '$output') throw new Error('Scoped authentication binding is invalid');
      secrets[name] = {
        value: JSON.stringify(auth.output ?? {}),
        version
      };
    }
  } else if (Object.keys(bindings.authSecretVersions).length > 0) {
    throw new Error('Scoped authentication owner binding is missing');
  }

  if (bindings.receiverCallback) {
    let callbackBinding = bindings.receiverCallback;
    let receiver = await db.slateTriggerReceiver.findFirst({
      where: {
        id: callbackBinding.receiverId,
        tenantOid: instance.tenantOid,
        slateInstanceOid: instance.oid,
        status: 'active',
        tombstonedAt: null
      },
      include: {
        tenant: true,
        triggers: {
          where: { id: callbackBinding.receiverTriggerId },
          include: { action: true }
        }
      }
    });
    let trigger = receiver?.triggers[0];
    let actionSpec = trigger?.action.spec as Record<string, unknown> | undefined;
    if (
      !receiver ||
      !trigger ||
      trigger.action.key !== callbackBinding.triggerActionId ||
      trigger.registrationStatus !== 'registered' ||
      trigger.tombstonedAt !== null ||
      trigger.ingressDisabledAt !== null ||
      trigger.registrationGeneration !== callbackBinding.registrationGeneration ||
      trigger.registrationVersion !== callbackBinding.registrationVersion ||
      trigger.verificationSpecHash !== callbackBinding.specHash ||
      actionSpec?.specHash !== callbackBinding.specHash
    ) {
      throw new Error('Receiver-bound callback grant is stale or ineligible');
    }

    let pathSecrets = await slateTriggerReceiverSecretService.resolvePathActiveAndRetiring({
      tenant: receiver.tenant,
      receiverId: receiver.id
    });
    let activePath = pathSecrets.find(item => item.secret.status === 'active');
    if (!activePath) throw new Error('Receiver-bound callback path secret is unavailable');
    secrets['receiver_callback:$url'] = {
      value: `${getTriggerWebhookBaseUrl(trigger.id)}/${encodeURIComponent(activePath.plaintext)}`,
      version: activePath.secret.secretVersion
    };

    for (let [name, version] of Object.entries(callbackBinding.projectedSecretVersions)) {
      let row = await db.slateTriggerReceiverSecret.findFirst({
        where: {
          receiverOid: receiver.oid,
          receiverTriggerOid: trigger.oid,
          specHash: callbackBinding.specHash,
          name,
          secretVersion: version,
          status: 'active'
        }
      });
      if (!row) throw new Error(`Receiver-bound callback secret is stale: ${name}`);
      let resolved = await slateTriggerReceiverSecretService.resolveBoundVendorSecrets({
        tenant: receiver.tenant,
        receiverId: receiver.id,
        receiverTriggerId: trigger.id,
        specHash: callbackBinding.specHash,
        sourceBindingType: row.sourceBindingType,
        sourceBindingId: row.sourceBindingId,
        name
      });
      let active = resolved.find(item => item.secret.id === row.id);
      if (!active) throw new Error(`Receiver-bound callback secret is unavailable: ${name}`);
      secrets[`receiver_callback:${name}`] = {
        value: active.plaintext,
        version
      };
    }
  }

  let secretNames = Object.keys(secrets).sort();
  if (JSON.stringify(secretNames) !== JSON.stringify([...d.expected.secretNames].sort())) {
    throw new Error('Scoped invocation secret binding set is invalid');
  }
  return { bindings, secrets };
};

export let authenticatedSlateTriggerReceiverSecretController =
  authenticatedSecretApp.controller({
    projectProvisionedAppRoute: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          projection: v.object({
            version: v.literal(1),
            entityKind: v.literal('route'),
            provisionedRouteId: v.string(),
            routeIdentifier: v.string(),
            vendor: v.string(),
            purpose: v.literal('shared_provisioned_app'),
            credentialOwnerRef: v.string(),
            generation: v.number(),
            routeSecretId: v.string(),
            routeSecretVersion: v.number(),
            vendorVerificationSecretId: v.string(),
            vendorVerificationVersion: v.number(),
            status: v.string(),
            tombstone: v.boolean(),
            tombstoneRetainUntil: v.nullable(v.string()),
            expiresAt: v.nullable(v.string())
          }),
          projectionDigest: v.string(),
          correlationId: v.string(),
          idempotencyKey: v.string()
        })
      )
      .do(async ctx => await projectSlateProvisionedAppRoute(ctx.input)),
    projectProvisionedTenantApp: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          projection: v.object({
            version: v.literal(1),
            entityKind: v.literal('binding'),
            provisionedTenantAppId: v.string(),
            provisionedRouteId: v.string(),
            routeIdentifier: v.string(),
            routeGeneration: v.number(),
            hubTenantId: v.string(),
            callbackInstanceId: v.string(),
            hubReceiverId: v.string(),
            hubReceiverGeneration: v.number(),
            hubReceiverTriggerId: v.string(),
            triggerActionId: v.string(),
            triggerSpecHash: v.string(),
            vendor: v.string(),
            purpose: v.literal('shared_provisioned_app'),
            externalAppId: v.nullable(v.string()),
            externalAccountId: v.nullable(v.string()),
            externalInstallationId: v.nullable(v.string()),
            externalOwnershipKey: v.nullable(v.string()),
            ownerIdentity: v.nullable(v.string()),
            credentialOwnerType: v.enumOf(['managed', 'byo']),
            credentialOwnerRef: v.string(),
            credentialSecretId: v.nullable(v.string()),
            credentialSecretPurpose: v.literal('vendor_verification'),
            credentialVersion: v.number(),
            generation: v.number(),
            status: v.string(),
            tombstone: v.boolean(),
            tombstoneRetainUntil: v.nullable(v.string()),
            expiresAt: v.nullable(v.string())
          }),
          projectionDigest: v.string(),
          correlationId: v.string(),
          idempotencyKey: v.string()
        })
      )
      .do(async ctx => await projectSlateProvisionedTenantApp(ctx.input)),
    getProvisionedAppProjectionState: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          entityKind: v.enumOf(['route', 'binding']),
          entityId: v.string()
        })
      )
      .do(async ctx => await getSlateProvisionedProjectionState(ctx.input)),
    validateProvisionedTenantCredentialSecret: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          provisionedTenantAppId: v.string(),
          hubTenantId: v.string(),
          callbackInstanceId: v.string(),
          provisionedRouteId: v.string(),
          routeGeneration: v.number(),
          vendor: v.string(),
          credentialOwnerRef: v.string(),
          credentialSecretId: v.string(),
          credentialSecretPurpose: v.literal('vendor_verification'),
          credentialVersion: v.number(),
          hubReceiverId: v.string(),
          hubReceiverGeneration: v.number(),
          hubReceiverTriggerId: v.string(),
          triggerActionId: v.string(),
          triggerSpecHash: v.string()
        })
      )
      .do(async ctx => await validateProvisionedTenantCredentialSecret(ctx.input)),
    createOrRotateProvisionedTenantCredentialSecret: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          provisionedTenantAppId: v.string(),
          importedValue: v.string()
        })
      )
      .do(
        async ctx =>
          await authenticatedProvisionedTenantSecretLifecycle.createOrRotate(ctx, ctx.input)
      ),
    revokeProvisionedTenantCredentialSecret: authenticatedSecretApp
      .handler()
      .input(v.object({ provisionedTenantAppId: v.string() }))
      .do(
        async ctx => await authenticatedProvisionedTenantSecretLifecycle.revoke(ctx, ctx.input)
      ),
    createOrRotateProvisionedAppRouteSecret: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          provisionedRouteId: v.string(),
          routeGeneration: v.number(),
          vendor: v.string(),
          credentialOwnerRef: v.string(),
          purpose: v.enumOf(['app_route_path', 'vendor_verification']),
          importedValue: v.optional(v.string()),
          graceMs: v.optional(v.number())
        })
      )
      .do(async ctx => {
        let result = await slateTriggerReceiverSecretService.createOrRotateAppRouteSecret({
          ...ctx.input,
          actor: actor(ctx)
        });
        return {
          ...presentTriggerSecretMutation(result),
          secretIssuanceReceipt: result.receipt ?? null
        };
      }),
    consumeProvisionedAppRouteSecretReceipt: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          provisionedRouteId: v.string(),
          receiptId: v.string(),
          receiptToken: v.string()
        })
      )
      .do(
        async ctx =>
          await slateTriggerReceiverSecretService.consumeAppRouteReceipt({
            provisionedRouteId: ctx.input.provisionedRouteId,
            receiptId: ctx.input.receiptId,
            token: ctx.input.receiptToken,
            actor: actor(ctx)
          })
      ),
    importInstanceConfig: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          slateInstanceConfigId: v.string(),
          path: v.string(),
          value: v.string()
        })
      )
      .do(
        async ctx =>
          await authenticatedInstanceConfigSecretLifecycle.importDeclared(ctx, ctx.input)
      ),
    redeemScopedToolInvocationGrant: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          caller: v.object({
            deploymentId: v.string(),
            runtimeIdentityId: v.string(),
            runtimeIdentityGeneration: v.number(),
            hubInvocationId: v.string()
          }),
          envelope: v.object({
            version: v.literal('scoped_invocation_grant_v1'),
            grantId: v.string(),
            token: v.string(),
            requestId: v.string()
          }),
          expected: v.object({
            requestId: v.string(),
            operation: v.literal('tool_invoke'),
            actionId: v.string(),
            secretNames: v.array(v.string())
          })
        })
      )
      .do(
        async ctx =>
          await authenticatedToolInvocationGrantRedemption({
            ...ctx.input,
            authenticatedContext: ctx
          })
      ),
    revokeInstanceConfig: authenticatedSecretApp
      .handler()
      .input(v.object({ slateInstanceConfigId: v.string(), key: v.string() }))
      .do(async ctx => {
        let config = await resolveConfigOwner(ctx.input.slateInstanceConfigId);
        return await slateTriggerReceiverSecretService.revokeInstanceConfigSecret({
          tenant: config.tenant,
          instanceConfigId: config.id,
          key: ctx.input.key,
          actor: actor(ctx)
        });
      }),
    reencryptRegistrationDetails: authenticatedSecretApp
      .handler()
      .input(v.object({ receiverTriggerId: v.string() }))
      .do(async ctx => {
        let result = await slateTriggerReceiverSecretService.reencryptRegistrationDetails({
          receiverTriggerId: ctx.input.receiverTriggerId,
          actor: actor(ctx)
        });
        return {
          receiverTriggerId: result.secret.id,
          registrationGeneration: result.secret.registrationGeneration,
          encryptionKeyVersion: result.secret.registrationDetailsEncryptionKeyVersion,
          aadVersion: result.secret.registrationDetailsAadVersion,
          auditCorrelationId: result.auditCorrelationId
        };
      }),
    reencryptInstanceConfig: authenticatedSecretApp
      .handler()
      .input(v.object({ slateInstanceConfigId: v.string(), secretId: v.string() }))
      .do(async ctx => {
        let config = await resolveConfigOwner(ctx.input.slateInstanceConfigId);
        return presentTriggerSecretMutation(
          await slateTriggerReceiverSecretService.reencryptInstanceConfigSecret({
            tenant: config.tenant,
            instanceConfigId: config.id,
            secretId: ctx.input.secretId,
            actor: actor(ctx)
          })
        );
      }),
    createReceiverPath: authenticatedSecretApp
      .handler()
      .input(v.object(callbackReceiverAuditFields))
      .do(async ctx => await authenticatedReceiverSecretLifecycle.createPath(ctx, ctx.input)),
    rotateReceiverPath: authenticatedSecretApp
      .handler()
      .input(v.object({ ...callbackReceiverAuditFields, graceMs: v.optional(v.number()) }))
      .do(async ctx => await authenticatedReceiverSecretLifecycle.rotatePath(ctx, ctx.input)),
    revokeReceiverPath: authenticatedSecretApp
      .handler()
      .input(v.object({ ...callbackReceiverAuditFields, secretId: v.string() }))
      .do(async ctx => await authenticatedReceiverSecretLifecycle.revokePath(ctx, ctx.input)),
    revokeAllReceiverPath: authenticatedSecretApp
      .handler()
      .input(v.object(callbackReceiverAuditFields))
      .do(
        async ctx => await authenticatedReceiverSecretLifecycle.revokeAllPath(ctx, ctx.input)
      ),
    reencryptReceiverPath: authenticatedSecretApp
      .handler()
      .input(v.object({ receiverId: v.string(), secretId: v.string() }))
      .do(async ctx => {
        let receiver = await resolveReceiverOwner(ctx.input.receiverId);
        return presentTriggerSecretMutation(
          await slateTriggerReceiverSecretService.reencryptPathSecret({
            tenant: receiver.tenant,
            receiverId: receiver.id,
            secretId: ctx.input.secretId,
            actor: actor(ctx)
          })
        );
      }),
    consumeReceiverPathReceipt: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          ...callbackReceiverAuditFields,
          receiptId: v.string(),
          receiptToken: v.string()
        })
      )
      .do(
        async ctx =>
          await authenticatedReceiverSecretLifecycle.consumePathReceipt(ctx, ctx.input)
      ),
    getReceiverSecretAuditByCorrelation: authenticatedSecretApp
      .handler()
      .input(v.object({ ...callbackReceiverAuditFields, auditCorrelationId: v.string() }))
      .do(async ctx => await authenticatedReceiverSecretLifecycle.getAudit(ctx, ctx.input)),
    generateDeclaredTriggerSecret: authenticatedSecretApp
      .handler()
      .input(v.object({ receiverTriggerId: v.string(), name: v.string() }))
      .do(async ctx => await authenticatedTriggerSecretLifecycle.generate(ctx, ctx.input)),
    importDeclaredTriggerSecret: authenticatedSecretApp
      .handler()
      .input(v.object({ receiverTriggerId: v.string(), name: v.string(), value: v.string() }))
      .do(async ctx => await authenticatedTriggerSecretLifecycle.import(ctx, ctx.input)),
    rotateImportedDeclaredTriggerSecret: authenticatedSecretApp
      .handler()
      .input(v.object({ receiverTriggerId: v.string(), name: v.string(), value: v.string() }))
      .do(
        async ctx => await authenticatedTriggerSecretLifecycle.rotateImported(ctx, ctx.input)
      ),
    resolveDeclaredTriggerSecretMetadata: authenticatedSecretApp
      .handler()
      .input(v.object({ receiverTriggerId: v.string(), name: v.string() }))
      .do(async ctx => await authenticatedTriggerSecretLifecycle.resolveMetadata(ctx.input)),
    reencryptDeclaredTriggerSecret: authenticatedSecretApp
      .handler()
      .input(
        v.object({ receiverTriggerId: v.string(), name: v.string(), secretId: v.string() })
      )
      .do(async ctx => await authenticatedTriggerSecretLifecycle.reencrypt(ctx, ctx.input)),
    revokeDeclaredTriggerSecret: authenticatedSecretApp
      .handler()
      .input(
        v.object({ receiverTriggerId: v.string(), name: v.string(), secretId: v.string() })
      )
      .do(async ctx => await authenticatedTriggerSecretLifecycle.revoke(ctx, ctx.input)),
    reencryptAppRouteSecret: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          provisionedRouteId: v.string(),
          purpose: v.enumOf(['app_route_path', 'vendor_verification']),
          secretId: v.string()
        })
      )
      .do(async ctx =>
        presentTriggerSecretMutation(
          await slateTriggerReceiverSecretService.reencryptAppRouteSecret({
            ...ctx.input,
            actor: actor(ctx)
          })
        )
      ),
    getWebhookCaptureConformanceResult: authenticatedSecretApp
      .handler()
      .input(v.object({ webhookRequestId: v.string() }))
      .do(async ctx => await authenticatedWebhookCaptureConformance.getCapture(ctx.input)),
    attestWebhookCaptureConformanceReport: authenticatedSecretApp
      .handler()
      .input(
        v.object({
          version: v.literal(1),
          reportId: v.string(),
          deploymentId: v.string(),
          runtime: v.string(),
          buildId: v.string(),
          route: v.string(),
          configDigest: v.string(),
          rawHeaderSource: v.literal('native'),
          executedAt: v.string(),
          expiresAt: v.string(),
          cases: v.record(v.enumOf(['passed', 'failed']))
        })
      )
      .do(
        async ctx =>
          await authenticatedWebhookCaptureConformance.attest(
            ctx.input as UnsignedWebhookCaptureConformanceReport
          )
      )
  });
