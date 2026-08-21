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
  ) return null;
  return rule as unknown as AuthoritativeWebhookRule;
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
      if (!d.validate(bindings)) throw new Error('Scoped invocation grant binding validation failed');
      let consumed = await tx.slateScopedInvocationGrant.updateMany({
        where: { tokenHash: d.tokenHash, status: 'active', expiresAt: { gt: d.now } },
        data: { status: 'consumed', consumedAt: d.now }
      });
      return consumed.count === 1 ? bindings : null;
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
        let key = requestKey(request);
        let binding = this.pending.get(key);
        this.pending.delete(key);
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
      return await this.grants.issue({ authorityHandle: resolved.handle, ttlMs: 60_000, request });
    } finally {
      this.grants.release({ handle: resolved.handle, request });
    }
  }

  private async load(receiverTriggerId: string) {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findUnique({
      where: { id: receiverTriggerId },
      include: {
        ...receiverTriggerInclude,
        boundSecrets: { include: { secret: { select: { id: true } } } }
      }
    });
    if (!receiverTrigger) throw new Error('Authoritative receiver trigger was not found');
    if (!receiverTrigger.receiver.slateInstance.currentConfig) {
      throw new Error('Authoritative receiver config is missing');
    }
    let version = await slateSessionService.getSessionVersion({
      slate: receiverTrigger.receiver.slate,
      slateInstance: receiverTrigger.receiver.slateInstance
    });
    let actionContract = receiverTrigger.action.spec as Record<string, unknown>;
    let published = actionContract.specHash;
    if (
      typeof published !== 'string' ||
      published !== computeHubWebhookActionSpecHashV1(actionContract)
    ) throw new Error('Published webhook action contract hash is invalid');
    return {
      receiverTrigger: receiverTrigger as ReceiverTriggerWithRelations & {
        boundSecrets: { secret: { id: string } }[];
      },
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

    let callbackSecretIds = new Set(
      loaded.receiverTrigger.boundSecrets.map(binding => binding.secret.id)
    );
    let redactionSentinels: string[] = [];
    for (let name of d.resolveVerificationSecrets === false
      ? []
      : (rule.verify.allowedSecretRefs ?? [])) {
      let resolved = await slateTriggerReceiverSecretService
        .resolveDeclaredTriggerSecretsForVerification({
          receiverTriggerId: loaded.receiverTrigger.id,
          name
        });
      if (resolved.length === 0) {
        throw new Error(`Authoritative callback secret is missing: ${name}`);
      }
      for (let secret of resolved) {
        callbackSecretIds.add(secret.id);
        redactionSentinels.push(secret.value);
      }
    }

    let candidateBindings = d.candidateBindings ?? [];
    if (
      rule.result.type === 'dispatch' &&
      rule.result.scope === 'verified_items' &&
      (d.itemAdapterId !== 'graph.body_value.v1' || candidateBindings.length === 0)
    ) throw new Error('Authoritative verified-item candidate projection is unavailable');
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
      authConfigId: loaded.receiverTrigger.receiver.authConfig?.id ?? null,
      callbackSecretIds: [...callbackSecretIds].sort(),
      ...(d.itemAdapterId ? { itemAdapterId: d.itemAdapterId } : {}),
      candidateBindings: candidateBindings.map(candidate => ({
        ...candidate,
        deliveryIds: [...candidate.deliveryIds]
      })),
      redactionSentinels
    };
  }

  private setPendingWebhookGrant(d: {
    request: ScopedInvocationGrantRequest;
    authority: AuthoritativeWebhookResolution;
    originalRequestHash: string;
    dispatchRequestHash: string;
  }) {
    if (d.request.operation === 'tool_invoke') throw new Error('Unexpected tool grant request');
    this.pending.set(requestKey(d.request), {
      tenantId: d.authority.receiverTrigger.receiver.tenant.id,
      slateInstanceId: d.authority.receiverTrigger.receiver.slateInstance.id,
      hubInvocationId: d.request.hubInvocationId,
      requestId: d.request.requestId,
      operation: d.request.operation,
      actionId: d.authority.actionId,
      specHash: d.authority.specHash,
      ruleId: d.authority.rule.id,
      originalRequestHash: d.originalRequestHash,
      dispatchRequestHash: d.dispatchRequestHash,
      receiverId: d.authority.receiverTrigger.receiver.id,
      receiverTriggerId: d.authority.receiverTrigger.id,
      registrationStatus: d.authority.registrationStatus,
      registrationGeneration: d.authority.registrationGeneration,
      registrationVersion: d.authority.registrationVersion,
      authConfigId: d.authority.authConfigId,
      callbackSecretIds: d.authority.callbackSecretIds,
      candidateBindings: d.authority.candidateBindings
    });
  }

  readonly webhookAuthorityResolver: SlateTriggerWebhookAuthorityResolver = {
    resolve: async d => {
      let authority = await this.buildResolution({ ...d, resolveVerificationSecrets: true });
      let request: ScopedInvocationGrantRequest = {
        requestId: d.requestId,
        operation: d.operation,
        receiverTriggerId: d.receiverTriggerId,
        hubInvocationId: d.hubInvocationId
      };
      let requestHash = computeHubWebhookWireRequestHash(d.request as never);
      this.setPendingWebhookGrant({
        request,
        authority,
        originalRequestHash: requestHash,
        dispatchRequestHash: requestHash
      });
      let resolved = await this.grants.resolve(request);
      return { authority, authorityHandle: resolved.handle };
    },

    resolveMapping: async d => {
      if (
        computeHubWebhookWireRequestHash(d.originalRequest as never) !== d.originalRequestHash ||
        computeHubWebhookWireRequestHash(d.dispatchRequest as never) !== d.dispatchRequestHash
      ) throw new Error('Authoritative webhook mapping hash is invalid');
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
      this.setPendingWebhookGrant({
        request,
        authority,
        originalRequestHash: d.originalRequestHash,
        dispatchRequestHash: d.dispatchRequestHash
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
      let requestHash = computeHubWebhookWireRequestHash(d.request as never);
      this.setPendingWebhookGrant({
        request,
        authority,
        originalRequestHash: requestHash,
        dispatchRequestHash: requestHash
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
      let result: AuthoritativeWebhookRegistration = {
        receiverTrigger: loaded.receiverTrigger,
        version: loaded.version,
        actionId: loaded.receiverTrigger.action.key,
        actionContract: loaded.actionContract,
        specHash: loaded.specHash,
        registrationStatus: loaded.receiverTrigger.registrationStatus,
        registrationGeneration: loaded.receiverTrigger.registrationGeneration,
        registrationVersion: loaded.receiverTrigger.registrationVersion,
        authConfigId: loaded.receiverTrigger.receiver.authConfig?.id ?? null,
        callbackSecretIds: loaded.receiverTrigger.boundSecrets
          .map(binding => binding.secret.id)
          .sort()
      };
      return result;
    }
  };

  readonly scopedGrantIssuer = {
    issue: async (d: {
      authorityHandle: Parameters<ScopedInvocationGrantAuthority['issue']>[0]['authorityHandle'];
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
