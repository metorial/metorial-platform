import {
  AcceptedWebhookVerificationProofAuthority,
  ScopedInvocationGrantAuthority,
  type ScopedInvocationGrantBindings,
  type ScopedInvocationGrantRequest,
  type ScopedInvocationGrantStore,
  type ScopedToolInvocationGrantBindings,
  type UnissuedScopedInvocationGrantBindings
} from '../lib/invocation/types';
import { db } from '../db';
import { getId } from '../id';
import { assertCanonicalStoredSlateConfigSchema } from '../lib/configPatch';
import {
  computeHubWebhookActionSpecHashV1,
  computeHubWebhookWireRequestHash
} from './slateTriggerReceiverRuntime';
import type {
  AuthoritativeWebhookRegistration,
  AuthoritativeWebhookResolution,
  AuthoritativeWebhookRule,
  SlateTriggerWebhookAuthorityResolver
} from './slateTriggerReceiverCore';
import { slateTriggerReceiverSecretService } from './slateTriggerReceiverSecret';
import {
  receiverTriggerInclude,
  type ReceiverTriggerWithRelations
} from './slateTriggerReceiverShared';
import { slateSessionService } from './slateSession';

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let findRule = (value: unknown, ruleId: string): AuthoritativeWebhookRule | null => {
  if (!isRecord(value)) return null;
  let invocation = value.invocation;
  if (!isRecord(invocation)) return null;
  let http = invocation.http;
  if (!isRecord(http)) return null;
  let ingress = http.ingress;
  if (!isRecord(ingress)) return null;
  let verification = ingress.verification;
  if (!isRecord(verification) || !Array.isArray(verification.rules)) return null;
  let matches = verification.rules.filter(rule => isRecord(rule) && rule.id === ruleId);
  if (matches.length !== 1) return null;
  let rule = matches[0]!;
  if (
    !['bootstrap', 'delivery', 'lifecycle'].includes(String(rule.phase)) ||
    !isRecord(rule.when) ||
    !isRecord(rule.result) ||
    !isRecord(rule.verify) ||
    typeof rule.verify.type !== 'string' ||
    (rule.verify.allowedSecretRefs !== undefined &&
      (!Array.isArray(rule.verify.allowedSecretRefs) ||
        !rule.verify.allowedSecretRefs.every((name: unknown) => typeof name === 'string')))
  ) {
    return null;
  }
  return rule as unknown as AuthoritativeWebhookRule;
};

let findDeclaredRegistrationNames = (value: unknown, result = new Set<string>()) => {
  if (Array.isArray(value)) value.forEach(item => findDeclaredRegistrationNames(item, result));
  else if (isRecord(value)) {
    if (value.source === 'registration' && typeof value.name === 'string')
      result.add(value.name);
    Object.values(value).forEach(child => findDeclaredRegistrationNames(child, result));
  }
  return result;
};

let requestKey = (request: ScopedInvocationGrantRequest) =>
  request.operation === 'tool_invoke'
    ? JSON.stringify([
        request.requestId,
        request.operation,
        request.deploymentId,
        request.runtimeIdentityId,
        request.runtimeIdentityGeneration,
        request.slateInstanceId,
        request.actionId,
        request.hubInvocationId
      ])
    : JSON.stringify([
        request.requestId,
        request.operation,
        request.receiverTriggerId,
        request.hubInvocationId,
        request.acceptedVerificationProofId ?? null
      ]);

let durableScopedGrantStore: ScopedInvocationGrantStore = {
  put: async d => {
    await db.slateScopedInvocationGrant.create({
      data: {
        ...getId('slateScopedInvocationGrant'),
        tokenHash: d.tokenHash,
        bindings: d.bindings as unknown as PrismaJson.SlateJson,
        expiresAt: d.expiresAt
      }
    });
  },
  consume: async d =>
    await db.$transaction(async tx => {
      let pending = await tx.slateScopedInvocationGrant.findUnique({
        where: { tokenHash: d.tokenHash }
      });
      if (!pending || pending.status !== 'active' || pending.expiresAt <= d.now) return null;
      let bindings = pending.bindings as unknown as Readonly<ScopedInvocationGrantBindings>;
      if (!d.validate(bindings)) {
        throw new Error('Scoped invocation grant binding validation failed');
      }
      let consumed = await tx.slateScopedInvocationGrant.updateMany({
        where: {
          tokenHash: d.tokenHash,
          status: 'active',
          expiresAt: { gt: d.now }
        },
        data: { status: 'consumed', consumedAt: d.now }
      });
      if (consumed.count !== 1) return null;
      let row = await tx.slateScopedInvocationGrant.findUniqueOrThrow({
        where: { tokenHash: d.tokenHash }
      });
      return row.bindings as unknown as Readonly<ScopedInvocationGrantBindings>;
    }),
  revoke: async d => {
    await db.slateScopedInvocationGrant.updateMany({
      where: { tokenHash: d.tokenHash, status: 'active' },
      data: { status: 'revoked', revokedAt: d.now }
    });
  }
};

class SlateTriggerReceiverProductionSecurity {
  private readonly pending = new Map<string, UnissuedScopedInvocationGrantBindings>();
  readonly acceptedVerificationProofs = new AcceptedWebhookVerificationProofAuthority();
  readonly grants = new ScopedInvocationGrantAuthority(
    {
      resolve: async request => {
        let binding = this.pending.get(requestKey(request));
        this.pending.delete(requestKey(request));
        if (!binding) throw new Error('Authoritative scoped grant binding is unavailable');
        return binding;
      }
    },
    undefined,
    undefined,
    durableScopedGrantStore
  );

  async issueToolGrant(
    bindings: Omit<ScopedToolInvocationGrantBindings, 'grantId' | 'issuedAtMs' | 'expiresAtMs'>
  ) {
    let request: ScopedInvocationGrantRequest = {
      requestId: bindings.requestId,
      operation: 'tool_invoke',
      deploymentId: bindings.deploymentId,
      runtimeIdentityId: bindings.runtimeIdentityId,
      runtimeIdentityGeneration: bindings.runtimeIdentityGeneration,
      slateInstanceId: bindings.slateInstanceId,
      actionId: bindings.actionId,
      hubInvocationId: bindings.hubInvocationId
    };
    this.pending.set(requestKey(request), bindings);
    let resolved = await this.grants.resolve(request);
    try {
      return await this.grants.issue({
        authorityHandle: resolved.handle,
        ttlMs: 60_000,
        request
      });
    } finally {
      this.grants.release({ handle: resolved.handle, request });
    }
  }

  private async load(receiverTriggerId: string) {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findUnique({
      where: { id: receiverTriggerId },
      include: receiverTriggerInclude
    });
    if (!receiverTrigger) throw new Error('Authoritative receiver trigger was not found');
    let currentConfig = receiverTrigger.receiver.slateInstance.currentConfig;
    if (!currentConfig) throw new Error('Authoritative receiver config is missing');
    let configSchema = await db.slateConfigSchema.findUnique({
      where: { oid: currentConfig.schemaOid }
    });
    if (!configSchema) throw new Error('Authoritative receiver config schema is missing');
    if (configSchema.version === 2) assertCanonicalStoredSlateConfigSchema(configSchema);
    let version = await slateSessionService.getSessionVersion({
      slate: receiverTrigger.receiver.slate,
      slateInstance: receiverTrigger.receiver.slateInstance
    });
    let actionContract = receiverTrigger.action.spec as Record<string, unknown>;
    let published = actionContract.specHash;
    if (
      typeof published !== 'string' ||
      published !== computeHubWebhookActionSpecHashV1(actionContract)
    ) {
      throw new Error('Published webhook action contract hash is invalid');
    }
    return {
      receiverTrigger: receiverTrigger as ReceiverTriggerWithRelations,
      currentConfig,
      configSchema,
      version,
      actionContract,
      specHash: published
    };
  }

  private async buildResolution(d: {
    receiverTriggerId: string;
    ruleId: string;
    request: unknown;
    hubInvocationId: string;
    requestId: string;
    itemAdapterId?: 'graph.body_value.v1';
    candidateBindings?: readonly {
      candidateId: string;
      index: number;
      bindingHash: string;
      deliveryIds: readonly string[];
    }[];
    resolveVerificationSecrets?: boolean;
  }): Promise<AuthoritativeWebhookResolution> {
    let loaded = await this.load(d.receiverTriggerId);
    let rule = findRule(loaded.actionContract, d.ruleId);
    if (!rule) throw new Error('Published webhook verification rule was not found');
    if (!isRecord(d.request)) throw new Error('Authoritative webhook request is invalid');
    let projectedSecretVersions: Record<string, number> = {};
    let redactionSentinels: string[] = [];
    for (let name of d.resolveVerificationSecrets === false
      ? []
      : (rule.verify.allowedSecretRefs ?? [])) {
      let row = await db.slateTriggerReceiverSecret.findFirst({
        where: {
          receiverTriggerOid: loaded.receiverTrigger.oid,
          specHash: loaded.specHash,
          name,
          status: 'active'
        },
        orderBy: { secretVersion: 'desc' }
      });
      if (!row) throw new Error(`Authoritative projected secret is missing: ${name}`);
      let resolved = await slateTriggerReceiverSecretService.resolveBoundVendorSecrets({
        tenant: loaded.receiverTrigger.receiver.tenant,
        receiverId: loaded.receiverTrigger.receiver.id,
        receiverTriggerId: loaded.receiverTrigger.id,
        specHash: loaded.specHash,
        sourceBindingType: row.sourceBindingType,
        sourceBindingId: row.sourceBindingId,
        name
      });
      let active = resolved.find(item => item.secret.id === row.id);
      if (!active) throw new Error(`Authoritative projected secret is stale: ${name}`);
      projectedSecretVersions[name] = row.secretVersion;
      redactionSentinels.push(active.plaintext);
    }
    let candidateBindings = d.candidateBindings ?? [];
    if (
      rule.result.type === 'dispatch' &&
      rule.result.scope === 'verified_items' &&
      (d.itemAdapterId !== 'graph.body_value.v1' || candidateBindings.length === 0)
    ) {
      throw new Error('Authoritative verified-item candidate projection is unavailable');
    }
    if (rule.result.type !== 'dispatch' || rule.result.scope !== 'verified_items') {
      if (d.itemAdapterId !== undefined || candidateBindings.length !== 0) {
        throw new Error('Unexpected authoritative webhook item candidates');
      }
    }
    return {
      receiverTrigger: loaded.receiverTrigger,
      version: loaded.version,
      actionId: loaded.receiverTrigger.action.key,
      hubInvocationId: d.hubInvocationId,
      actionContract: loaded.actionContract,
      specHash: loaded.specHash,
      rule,
      registrationStatus: loaded.receiverTrigger.registrationStatus,
      registrationGeneration: loaded.receiverTrigger.registrationGeneration,
      registrationVersion: loaded.receiverTrigger.registrationVersion,
      projectedSecretVersions,
      ...(d.itemAdapterId ? { itemAdapterId: d.itemAdapterId } : {}),
      candidateBindings: candidateBindings.map(candidate => ({
        ...candidate,
        deliveryIds: [...candidate.deliveryIds]
      })),
      redactionSentinels
    };
  }

  readonly webhookAuthorityResolver: SlateTriggerWebhookAuthorityResolver = {
    resolve: async d => {
      let authority = await this.buildResolution({
        ...d,
        resolveVerificationSecrets: true
      });
      let request: ScopedInvocationGrantRequest = {
        requestId: d.requestId,
        operation: d.operation,
        receiverTriggerId: d.receiverTriggerId,
        hubInvocationId: d.hubInvocationId
      };
      let originalRequestHash = computeHubWebhookWireRequestHash(d.request as never);
      this.pending.set(requestKey(request), {
        tenantId: authority.receiverTrigger.receiver.tenant.id,
        slateInstanceId: authority.receiverTrigger.receiver.slateInstance.id,
        configSchemaVersion:
          authority.receiverTrigger.receiver.slateInstance.currentConfig!.schema.version,
        configSchemaHash: (
          await db.slateConfigSchema.findUniqueOrThrow({
            where: {
              oid: authority.receiverTrigger.receiver.slateInstance.currentConfig!.schemaOid
            }
          })
        ).hash,
        hubInvocationId: d.hubInvocationId,
        requestId: d.requestId,
        operation: d.operation,
        actionId: authority.actionId,
        specHash: authority.specHash,
        ruleId: authority.rule.id,
        originalRequestHash,
        dispatchRequestHash: originalRequestHash,
        receiverId: authority.receiverTrigger.receiver.id,
        receiverTriggerId: authority.receiverTrigger.id,
        registrationStatus: authority.registrationStatus,
        registrationGeneration: authority.registrationGeneration,
        registrationVersion: authority.registrationVersion,
        projectedSecretVersions: authority.projectedSecretVersions,
        candidateBindings: authority.candidateBindings
      });
      let resolved = await this.grants.resolve(request);
      return { authority, authorityHandle: resolved.handle };
    },
    resolveMapping: async d => {
      if (
        computeHubWebhookWireRequestHash(d.originalRequest as never) !==
          d.originalRequestHash ||
        computeHubWebhookWireRequestHash(d.dispatchRequest as never) !== d.dispatchRequestHash
      ) {
        throw new Error('Authoritative webhook mapping hash is invalid');
      }
      let authority = await this.buildResolution({
        receiverTriggerId: d.receiverTriggerId,
        ruleId: d.ruleId,
        request: d.originalRequest,
        hubInvocationId: d.hubInvocationId,
        requestId: d.requestId,
        itemAdapterId: d.itemAdapterId,
        candidateBindings: d.candidateBindings,
        resolveVerificationSecrets: false
      });
      let request: ScopedInvocationGrantRequest = {
        requestId: d.requestId,
        operation: d.operation,
        receiverTriggerId: d.receiverTriggerId,
        hubInvocationId: d.hubInvocationId
      };
      this.pending.set(requestKey(request), {
        tenantId: authority.receiverTrigger.receiver.tenant.id,
        slateInstanceId: authority.receiverTrigger.receiver.slateInstance.id,
        configSchemaVersion:
          authority.receiverTrigger.receiver.slateInstance.currentConfig!.schema.version,
        configSchemaHash: (
          await db.slateConfigSchema.findUniqueOrThrow({
            where: {
              oid: authority.receiverTrigger.receiver.slateInstance.currentConfig!.schemaOid
            }
          })
        ).hash,
        hubInvocationId: d.hubInvocationId,
        requestId: d.requestId,
        operation: d.operation,
        actionId: authority.actionId,
        specHash: authority.specHash,
        ruleId: authority.rule.id,
        originalRequestHash: d.originalRequestHash,
        dispatchRequestHash: d.dispatchRequestHash,
        receiverId: authority.receiverTrigger.receiver.id,
        receiverTriggerId: authority.receiverTrigger.id,
        registrationStatus: authority.registrationStatus,
        registrationGeneration: authority.registrationGeneration,
        registrationVersion: authority.registrationVersion,
        projectedSecretVersions: {},
        candidateBindings: authority.candidateBindings
      });
      let resolved = await this.grants.resolve(request);
      return { authority, authorityHandle: resolved.handle };
    },
    resolveAcceptedProof: async d => {
      let authority = await this.buildResolution({
        receiverTriggerId: d.proof.receiverTriggerId,
        ruleId: d.proof.ruleId,
        request: d.request,
        hubInvocationId: d.hubInvocationId,
        requestId: d.requestId
      });
      let request: ScopedInvocationGrantRequest = {
        requestId: d.requestId,
        operation: d.operation,
        receiverTriggerId: d.proof.receiverTriggerId,
        hubInvocationId: d.hubInvocationId,
        acceptedVerificationProofId: d.proof.proofId
      };
      let originalRequestHash = computeHubWebhookWireRequestHash(d.request as never);
      this.pending.set(requestKey(request), {
        tenantId: authority.receiverTrigger.receiver.tenant.id,
        slateInstanceId: authority.receiverTrigger.receiver.slateInstance.id,
        configSchemaVersion:
          authority.receiverTrigger.receiver.slateInstance.currentConfig!.schema.version,
        configSchemaHash: (
          await db.slateConfigSchema.findUniqueOrThrow({
            where: {
              oid: authority.receiverTrigger.receiver.slateInstance.currentConfig!.schemaOid
            }
          })
        ).hash,
        hubInvocationId: d.hubInvocationId,
        requestId: d.requestId,
        operation: d.operation,
        actionId: authority.actionId,
        specHash: authority.specHash,
        ruleId: authority.rule.id,
        originalRequestHash,
        dispatchRequestHash: originalRequestHash,
        receiverId: authority.receiverTrigger.receiver.id,
        receiverTriggerId: authority.receiverTrigger.id,
        registrationStatus: authority.registrationStatus,
        registrationGeneration: authority.registrationGeneration,
        registrationVersion: authority.registrationVersion,
        projectedSecretVersions: authority.projectedSecretVersions,
        candidateBindings: authority.candidateBindings
      });
      let resolved = await this.grants.resolve(request);
      return { authority, authorityHandle: resolved.handle };
    },
    release: async d => {
      this.grants.release({
        handle: d.authorityHandle,
        request: {
          requestId: d.requestId,
          operation: d.operation,
          receiverTriggerId: d.receiverTriggerId,
          hubInvocationId: d.hubInvocationId,
          acceptedVerificationProofId: d.acceptedVerificationProofId
        }
      });
    },
    resolveRegistration: async d => {
      let loaded = await this.load(d.receiverTriggerId);
      let capturedSecretVersions: Record<string, number> = {};
      let captureNames = new Set(
        loaded.actionContract.invocation &&
          isRecord(loaded.actionContract.invocation) &&
          isRecord(loaded.actionContract.invocation.http) &&
          isRecord(loaded.actionContract.invocation.http.ingress) &&
          isRecord(loaded.actionContract.invocation.http.ingress.verification) &&
          Array.isArray(loaded.actionContract.invocation.http.ingress.verification.rules)
          ? loaded.actionContract.invocation.http.ingress.verification.rules.flatMap(rule =>
              isRecord(rule) &&
              isRecord(rule.verify) &&
              Array.isArray(rule.verify.allowedBootstrapCaptureRefs)
                ? rule.verify.allowedBootstrapCaptureRefs.filter(
                    (name): name is string => typeof name === 'string'
                  )
                : []
            )
          : []
      );
      for (let name of [...findDeclaredRegistrationNames(loaded.actionContract)].filter(
        name => !captureNames.has(name)
      )) {
        let current = await db.slateTriggerReceiverSecret.findFirst({
          where: {
            receiverTriggerOid: loaded.receiverTrigger.oid,
            specHash: loaded.specHash,
            name,
            status: 'active'
          },
          orderBy: { secretVersion: 'desc' }
        });
        capturedSecretVersions[name] = (current?.secretVersion ?? 0) + 1;
      }
      let result: AuthoritativeWebhookRegistration = {
        receiverTrigger: loaded.receiverTrigger,
        version: loaded.version,
        actionId: loaded.receiverTrigger.action.key,
        actionContract: loaded.actionContract,
        specHash: loaded.specHash,
        registrationStatus: loaded.receiverTrigger.registrationStatus,
        registrationGeneration: loaded.receiverTrigger.registrationGeneration,
        registrationVersion: loaded.receiverTrigger.registrationVersion,
        capturedSecretVersions
      };
      return result;
    }
  };

  readonly scopedGrantIssuer = {
    issue: async (d: {
      authorityHandle: Parameters<
        ScopedInvocationGrantAuthority['issue']
      >[0]['authorityHandle'];
      receiverTriggerId: string;
      hubInvocationId: string;
      requestId: string;
      operation: Exclude<ScopedInvocationGrantRequest['operation'], 'tool_invoke'>;
      acceptedVerificationProofId?: string;
    }) =>
      await this.grants.issue({
        authorityHandle: d.authorityHandle,
        ttlMs: 60_000,
        request: {
          receiverTriggerId: d.receiverTriggerId,
          hubInvocationId: d.hubInvocationId,
          requestId: d.requestId,
          operation: d.operation,
          acceptedVerificationProofId: d.acceptedVerificationProofId
        }
      }),
    revoke: async (envelope: Parameters<ScopedInvocationGrantAuthority['revoke']>[0]) => {
      await this.grants.revoke(envelope);
    }
  };

  async redeemScopedGrant(d: Parameters<ScopedInvocationGrantAuthority['redeem']>[0]) {
    return await this.grants.redeem(d);
  }
}

export let slateTriggerReceiverProductionSecurity =
  new SlateTriggerReceiverProductionSecurity();
export let authenticatedScopedGrantRedemption = {
  redeem: async (
    d: Omit<Parameters<ScopedInvocationGrantAuthority['redeem']>[0], 'authenticated'>
  ) =>
    await slateTriggerReceiverProductionSecurity.redeemScopedGrant({
      ...d,
      authenticated: true
    })
};
