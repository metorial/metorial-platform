import type {
  SlatesNotifications,
  SlatesParticipant,
  SlatesRequests,
  slatesRequestTrace,
  SlatesResponses,
  slatesResponsesByMethod
} from '@slates/proto';
import type z from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import type { SlateInvocation, SlateVersion, Tenant } from '../../../prisma/generated/client';
import type { SlateInvocationProviderMetadata } from './store';

export interface SlateInvocationDeploymentTarget {
  providerDeploymentInfo: NonNullable<PrismaJson.SlateDeploymentProviderDeploymentInfo>;
  activeDeploymentOid: bigint;
}

export interface SlateInvocationBaseParams {
  tenant?: Pick<
    Tenant,
    'oid' | 'identifier' | 'name' | 'functionBayTenantId' | 'functionBayTenantIdentifier'
  >;
  slateVersion: SlateVersion;
  deploymentTarget?: SlateInvocationDeploymentTarget;
  participants: SlatesParticipant[];
  enclaveId?: string;
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
  invocationId?: string;
  scopedSecurity?: {
    redactionSentinels: readonly string[];
    forbiddenValues: readonly string[];
    executionControl: ScopedInvocationExecutionControl;
  };
  artifactSecurity?: {
    redactionSentinels: readonly string[];
    forbiddenValues: readonly string[];
  };
  canonicalConfigSchema?: Record<string, unknown>;
}

export interface ScopedInvocationExecutionControl {
  timeoutMs: number;
  assertIsolation(d: {
    hubInvocationId: string;
    networkEgress: 'deny_all';
    sideEffects: 'deny_all';
    adversarialProbes: readonly ['network', 'persistence', 'event'];
  }): Promise<{
    status: 'enforced';
    hubInvocationId: string;
    networkEgress: 'deny_all';
    sideEffects: 'deny_all';
    deniedEffects: readonly ['network', 'persistence', 'event'];
  }>;
  probeDeniedEffect(d: {
    hubInvocationId: string;
    effect: 'network' | 'persistence' | 'event';
  }): Promise<{
    status: 'denied';
    hubInvocationId: string;
    effect: 'network' | 'persistence' | 'event';
  }>;
  terminate(d: {
    hubInvocationId: string;
    reason: 'timeout' | 'cancelled';
  }): Promise<{ status: 'terminated'; hubInvocationId: string }>;
}

export type InvocationArtifactSecurity = {
  redactionSentinels: readonly string[];
  forbiddenValues: readonly string[];
};

export let runScopedRemoteInvocation = async <Result>(d: {
  hubInvocationId: string;
  invoke: () => Promise<Result>;
  control: ScopedInvocationExecutionControl;
}): Promise<Result> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let invocation = d.invoke();
  invocation.catch(() => {});
  let outcome: { type: 'result'; result: Result } | { type: 'timeout' };
  try {
    outcome = await Promise.race([
      invocation.then(result => ({ type: 'result' as const, result })),
      new Promise<{ type: 'timeout' }>(resolve => {
        timer = setTimeout(() => resolve({ type: 'timeout' }), d.control.timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (outcome.type === 'result') return outcome.result;
  let acknowledgement = await d.control.terminate({
    hubInvocationId: d.hubInvocationId,
    reason: 'timeout'
  });
  if (
    acknowledgement.status !== 'terminated' ||
    acknowledgement.hubInvocationId !== d.hubInvocationId
  ) {
    throw new Error('Scoped invocation termination was not acknowledged');
  }
  throw new Error('Scoped invocation timed out after confirmed remote termination');
};

export let assertScopedInvocationIsolation = async (d: {
  hubInvocationId: string;
  control: ScopedInvocationExecutionControl;
}) => {
  let isolation = await d.control.assertIsolation({
    hubInvocationId: d.hubInvocationId,
    networkEgress: 'deny_all',
    sideEffects: 'deny_all',
    adversarialProbes: ['network', 'persistence', 'event']
  });
  if (
    isolation.status !== 'enforced' ||
    isolation.hubInvocationId !== d.hubInvocationId ||
    isolation.networkEgress !== 'deny_all' ||
    isolation.sideEffects !== 'deny_all' ||
    JSON.stringify(isolation.deniedEffects) !==
      JSON.stringify(['network', 'persistence', 'event'])
  ) {
    throw new Error('Trusted scoped invocation isolation was not acknowledged');
  }
  for (let effect of ['network', 'persistence', 'event'] as const) {
    let denial = await d.control.probeDeniedEffect({
      hubInvocationId: d.hubInvocationId,
      effect
    });
    if (
      denial.status !== 'denied' ||
      denial.hubInvocationId !== d.hubInvocationId ||
      denial.effect !== effect
    ) {
      throw new Error(`Trusted scoped ${effect} denial was not acknowledged`);
    }
  }
  return isolation;
};

export let sanitizeScopedInvocationValue = <Value>(
  value: Value,
  scopedSecurity?: InvocationArtifactSecurity
): Value => {
  if (!scopedSecurity) return value;
  let sentinels = [
    ...scopedSecurity.redactionSentinels,
    ...scopedSecurity.forbiddenValues
  ].filter(sentinel => sentinel.length > 0);
  let seen = new WeakMap<object, unknown>();
  let visit = (entry: unknown): unknown => {
    if (typeof entry === 'string') {
      return sentinels.reduce(
        (result, sentinel) => result.split(sentinel).join('[REDACTED]'),
        entry
      );
    }
    if (entry === null || typeof entry !== 'object') return entry;
    if (entry instanceof Error) {
      let sanitized = new Error(visit(entry.message) as string);
      sanitized.name = entry.name;
      sanitized.stack = entry.stack ? (visit(entry.stack) as string) : undefined;
      return sanitized;
    }
    let existing = seen.get(entry);
    if (existing) return existing;
    if (Array.isArray(entry)) {
      let result: unknown[] = [];
      seen.set(entry, result);
      entry.forEach(item => result.push(visit(item)));
      return result;
    }
    let result: Record<string, unknown> = {};
    seen.set(entry, result);
    Object.entries(entry).forEach(([key, nested]) => {
      result[key] = visit(nested);
    });
    return result;
  };
  return visit(value) as Value;
};

export type ScopedInvocationArtifactKind = 'persistence' | 'logging' | 'tracing' | 'reporting';

/** Single scoped-operation choke point used before an artifact reaches storage,
 * Function Bay log/trace extraction, process logging, or error reporting. */
export let createScopedInvocationArtifactBoundary = (
  scopedSecurity: InvocationArtifactSecurity | undefined,
  observers: Partial<Record<ScopedInvocationArtifactKind, (value: unknown) => void>> = {}
) => {
  let pass = <Value>(kind: ScopedInvocationArtifactKind, value: Value) => {
    let sanitized = sanitizeScopedInvocationValue(value, scopedSecurity);
    observers[kind]?.(sanitized);
    return sanitized;
  };
  return {
    persistence: <Value>(value: Value) => pass('persistence', value),
    logging: <Value>(value: Value) => pass('logging', value),
    tracing: <Value>(value: Value) => pass('tracing', value),
    reporting: <Value>(value: Value) => pass('reporting', value)
  };
};

export type SlatesRequest = SlatesNotifications | SlatesRequests;
export type SlatesResponse = SlatesNotifications | SlatesResponses;
export type SlatesRequestTrace = z.infer<typeof slatesRequestTrace>;

export interface InvocationError {
  code: string;
  message: string;
  [key: string]: string;
}

export type InvocationResult<Key extends keyof typeof slatesResponsesByMethod = any> =
  | {
      status: 'success';
      invocation: SlateInvocation;
      data: z.infer<(typeof slatesResponsesByMethod)[Key]>['result'];
    }
  | {
      status: 'error';
      invocation: SlateInvocation;
      error: InvocationError;
    };

export interface StoredSlateInvocation {
  id: string;
  requests: SlatesRequest[];
  responses: SlatesResponse[];
  logs: [number, string][];
  provider?: SlateInvocationProviderMetadata;
  requestTraces?: SlatesRequestTrace[];
}

export interface SlatesScopedInvocationGrantEnvelope {
  version: 'scoped_invocation_grant_v1';
  grantId: string;
  token: string;
  requestId: string;
}

export type ScopedSlateInvocationRequest = SlatesRequests & {
  invocation?: SlatesScopedInvocationGrantEnvelope;
};

export type ScopedInvocationGrantOperation =
  | 'webhook_verify'
  | 'webhook_bootstrap_capture'
  | 'webhook_handle'
  | 'tool_invoke';

export interface ScopedWebhookCandidateBinding {
  candidateId: string;
  index: number;
  bindingHash: string;
  deliveryIds: readonly string[];
}

interface ScopedReceiverWebhookInvocationGrantBindingBase {
  grantId: string;
  tenantId: string;
  slateInstanceId: string;
  hubInvocationId: string;
  requestId: string;
  actionId: string;
  specHash: string;
  ruleId: string;
  originalRequestHash: string;
  dispatchRequestHash: string;
  issuedAtMs: number;
  expiresAtMs: number;
  receiverId: string;
  receiverTriggerId: string;
  registrationStatus: string;
  registrationGeneration: number;
  registrationVersion: number;
  authConfigId: string | null;
  callbackSecretIds: readonly string[];
  candidateBindings: readonly Readonly<ScopedWebhookCandidateBinding>[];
}

export type ScopedReceiverWebhookInvocationGrantBindings =
  ScopedReceiverWebhookInvocationGrantBindingBase &
    (
      | { operation: 'webhook_verify' }
      | { operation: 'webhook_bootstrap_capture' }
      | { operation: 'webhook_handle' }
    );

export interface ScopedToolInvocationGrantBindings {
  grantId: string;
  deploymentId: string;
  runtimeIdentityId: string;
  runtimeIdentityGeneration: number;
  tenantId: string;
  slateInstanceId: string;
  hubInvocationId: string;
  requestId: string;
  actionId: string;
  operation: 'tool_invoke';
  issuedAtMs: number;
  expiresAtMs: number;
  authConfigId: string | null;
  callbackSecretIds: readonly string[];
  receiverCallback?: Readonly<{
    receiverId: string;
    receiverTriggerId: string;
    triggerActionId: string;
    specHash: string;
    registrationGeneration: number;
    registrationVersion: number;
    authConfigId: string | null;
    callbackSecretIds: readonly string[];
  }>;
}

export type ScopedInvocationGrantBindings =
  | ScopedReceiverWebhookInvocationGrantBindings
  | ScopedToolInvocationGrantBindings;

export type UnissuedScopedInvocationGrantBindings =
  | Omit<
      ScopedReceiverWebhookInvocationGrantBindings,
      'grantId' | 'issuedAtMs' | 'expiresAtMs'
    >
  | Omit<ScopedToolInvocationGrantBindings, 'grantId' | 'issuedAtMs' | 'expiresAtMs'>;

export interface ScopedInvocationAuthorityHandle {
  version: 'scoped_invocation_authority_v1';
  id: string;
  token: string;
}

export type ScopedInvocationGrantRequest =
  | {
      requestId: string;
      operation: Exclude<ScopedInvocationGrantOperation, 'tool_invoke'>;
      receiverTriggerId: string;
      hubInvocationId: string;
      acceptedVerificationProofId?: string;
    }
  | {
      requestId: string;
      operation: 'tool_invoke';
      deploymentId: string;
      runtimeIdentityId: string;
      runtimeIdentityGeneration: number;
      slateInstanceId: string;
      actionId: string;
      hubInvocationId: string;
    };

export interface ScopedInvocationGrantResolver {
  resolve(
    request: Readonly<ScopedInvocationGrantRequest>
  ): Promise<UnissuedScopedInvocationGrantBindings>;
}

export interface ScopedInvocationGrantIssueInput {
  request: ScopedInvocationGrantRequest;
  authorityHandle: ScopedInvocationAuthorityHandle;
  ttlMs: number;
}

export interface ScopedInvocationGrantStore {
  put(d: {
    tokenHash: string;
    bindings: Readonly<ScopedInvocationGrantBindings>;
    expiresAt: Date;
  }): Promise<void>;
  consume(d: {
    tokenHash: string;
    now: Date;
    validate(bindings: Readonly<ScopedInvocationGrantBindings>): boolean;
  }): Promise<Readonly<ScopedInvocationGrantBindings> | null>;
  revoke(d: { tokenHash: string; now: Date }): Promise<void>;
}

let grantTokenHash = (token: string) =>
  createHash('sha256').update(`slates-scoped-grant-v1:${token}`).digest('hex');

let sameRequest = (
  left: ScopedInvocationGrantRequest,
  right: ScopedInvocationGrantRequest
) => {
  if (
    left.requestId !== right.requestId ||
    left.operation !== right.operation ||
    left.hubInvocationId !== right.hubInvocationId
  ) return false;
  if (left.operation === 'tool_invoke' && right.operation === 'tool_invoke') {
    return (
      left.deploymentId === right.deploymentId &&
      left.runtimeIdentityId === right.runtimeIdentityId &&
      left.runtimeIdentityGeneration === right.runtimeIdentityGeneration &&
      left.slateInstanceId === right.slateInstanceId &&
      left.actionId === right.actionId
    );
  }
  if (left.operation === 'tool_invoke' || right.operation === 'tool_invoke') return false;
  return (
    left.receiverTriggerId === right.receiverTriggerId &&
    left.acceptedVerificationProofId === right.acceptedVerificationProofId
  );
};

let freezeBindings = <Bindings extends UnissuedScopedInvocationGrantBindings>(
  bindings: Bindings
): Bindings =>
  Object.freeze({
    ...bindings,
    callbackSecretIds: Object.freeze([...bindings.callbackSecretIds]),
    ...(bindings.operation === 'tool_invoke'
      ? bindings.receiverCallback
        ? {
            receiverCallback: Object.freeze({
              ...bindings.receiverCallback,
              callbackSecretIds: Object.freeze([
                ...bindings.receiverCallback.callbackSecretIds
              ])
            })
          }
        : {}
      : {
          candidateBindings: Object.freeze(
            bindings.candidateBindings.map(candidate =>
              Object.freeze({
                ...candidate,
                deliveryIds: Object.freeze([...candidate.deliveryIds])
              })
            )
          )
        })
  }) as Bindings;

let validOpaqueIds = (ids: readonly string[]) =>
  ids.length <= 64 &&
  new Set(ids).size === ids.length &&
  ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256);

export class ScopedInvocationGrantAuthority {
  private readonly grants = new Map<
    string,
    Readonly<{ token: string; bindings: Readonly<ScopedInvocationGrantBindings> }>
  >();
  private readonly resolutions = new Map<
    string,
    Readonly<{
      id: string;
      request: Readonly<ScopedInvocationGrantRequest>;
      bindings: UnissuedScopedInvocationGrantBindings;
      expiresAtMs: number;
    }>
  >();
  private readonly terminalResolutions = new Map<
    string,
    Readonly<{ id: string; request: Readonly<ScopedInvocationGrantRequest>; expiresAtMs: number }>
  >();

  constructor(
    private readonly resolver: ScopedInvocationGrantResolver,
    private readonly now = () => Date.now(),
    private readonly resolutionTtlMs = 30_000,
    private readonly store?: ScopedInvocationGrantStore
  ) {}

  private purgeExpiredResolutions() {
    let now = this.now();
    for (let [token, resolution] of this.resolutions) {
      if (resolution.expiresAtMs > now) continue;
      this.resolutions.delete(token);
      this.terminalResolutions.set(
        token,
        Object.freeze({
          id: resolution.id,
          request: resolution.request,
          expiresAtMs: now + this.resolutionTtlMs
        })
      );
    }
    for (let [token, terminal] of this.terminalResolutions) {
      if (terminal.expiresAtMs <= now) this.terminalResolutions.delete(token);
    }
  }

  async resolve(request: ScopedInvocationGrantRequest) {
    this.purgeExpiredResolutions();
    let bindings = freezeBindings(await this.resolver.resolve(Object.freeze({ ...request })));
    let id = randomUUID();
    let token = randomUUID();
    let handle = Object.freeze({
      version: 'scoped_invocation_authority_v1' as const,
      id,
      token
    });
    this.resolutions.set(
      token,
      Object.freeze({
        id,
        request: Object.freeze({ ...request }),
        bindings,
        expiresAtMs: this.now() + this.resolutionTtlMs
      })
    );
    return Object.freeze({ handle, bindings });
  }

  async issue(d: ScopedInvocationGrantIssueInput): Promise<SlatesScopedInvocationGrantEnvelope> {
    this.purgeExpiredResolutions();
    let resolution = this.resolutions.get(d.authorityHandle.token);
    this.resolutions.delete(d.authorityHandle.token);
    if (resolution) {
      this.terminalResolutions.set(
        d.authorityHandle.token,
        Object.freeze({
          id: resolution.id,
          request: resolution.request,
          expiresAtMs: this.now() + this.resolutionTtlMs
        })
      );
    }
    if (
      !resolution ||
      d.authorityHandle.version !== 'scoped_invocation_authority_v1' ||
      resolution.expiresAtMs <= this.now() ||
      !sameRequest(resolution.request, d.request) ||
      resolution.id !== d.authorityHandle.id
    ) {
      throw new Error('Scoped invocation authority handle is invalid or already consumed');
    }
    let resolved = resolution.bindings;
    let invalid =
      d.ttlMs <= 0 ||
      resolved.requestId !== d.request.requestId ||
      resolved.operation !== d.request.operation ||
      resolved.hubInvocationId !== d.request.hubInvocationId ||
      !resolved.tenantId ||
      !resolved.slateInstanceId ||
      !resolved.actionId ||
      !validOpaqueIds(resolved.callbackSecretIds);
    if (resolved.operation === 'tool_invoke') {
      invalid ||=
        d.request.operation !== 'tool_invoke' ||
        resolved.deploymentId !== d.request.deploymentId ||
        resolved.runtimeIdentityId !== d.request.runtimeIdentityId ||
        resolved.runtimeIdentityGeneration !== d.request.runtimeIdentityGeneration ||
        !resolved.deploymentId ||
        !resolved.runtimeIdentityId ||
        !Number.isInteger(resolved.runtimeIdentityGeneration) ||
        resolved.runtimeIdentityGeneration <= 0 ||
        resolved.slateInstanceId !== d.request.slateInstanceId ||
        resolved.actionId !== d.request.actionId ||
        (resolved.receiverCallback !== undefined &&
          (!resolved.receiverCallback.receiverId ||
            !resolved.receiverCallback.receiverTriggerId ||
            !resolved.receiverCallback.triggerActionId ||
            !/^[a-f0-9]{64}$/.test(resolved.receiverCallback.specHash) ||
            resolved.receiverCallback.registrationGeneration <= 0 ||
            resolved.receiverCallback.registrationVersion <= 0 ||
            !validOpaqueIds(resolved.receiverCallback.callbackSecretIds)));
    } else {
      invalid ||=
        d.request.operation === 'tool_invoke' ||
        resolved.receiverTriggerId !== d.request.receiverTriggerId ||
        !/^[a-f0-9]{64}$/.test(resolved.specHash) ||
        !resolved.ruleId ||
        !/^[a-f0-9]{64}$/.test(resolved.originalRequestHash) ||
        !/^[a-f0-9]{64}$/.test(resolved.dispatchRequestHash) ||
        !resolved.receiverId ||
        !resolved.registrationStatus ||
        resolved.registrationGeneration <= 0 ||
        resolved.registrationVersion <= 0 ||
        new Set(resolved.candidateBindings.map(candidate => candidate.candidateId)).size !==
          resolved.candidateBindings.length ||
        new Set(resolved.candidateBindings.map(candidate => candidate.index)).size !==
          resolved.candidateBindings.length ||
        resolved.candidateBindings.some(
          candidate =>
            !candidate.candidateId ||
            !Number.isInteger(candidate.index) ||
            candidate.index < 0 ||
            !/^[a-f0-9]{64}$/.test(candidate.bindingHash) ||
            candidate.deliveryIds.length === 0 ||
            new Set(candidate.deliveryIds).size !== candidate.deliveryIds.length ||
            candidate.deliveryIds.some(deliveryId => !deliveryId)
        );
    }
    if (invalid) throw new Error('Invalid scoped invocation grant bindings');

    let grantId = randomUUID();
    let token = randomUUID();
    let issuedAtMs = this.now();
    let bindings = Object.freeze({
      ...freezeBindings(resolved),
      grantId,
      issuedAtMs,
      expiresAtMs: issuedAtMs + d.ttlMs
    }) as Readonly<ScopedInvocationGrantBindings>;
    if (this.store) {
      await this.store.put({
        tokenHash: grantTokenHash(token),
        bindings,
        expiresAt: new Date(bindings.expiresAtMs)
      });
    } else {
      this.grants.set(token, Object.freeze({ token, bindings }));
    }
    return Object.freeze({
      version: 'scoped_invocation_grant_v1',
      grantId,
      token,
      requestId: bindings.requestId
    });
  }

  async redeem(d: {
    envelope: SlatesScopedInvocationGrantEnvelope;
    authenticated: boolean;
    expected: {
      requestId: string;
      operation: ScopedInvocationGrantOperation;
      actionId: string;
      [key: string]: unknown;
    };
  }) {
    if (!d.authenticated) throw new Error('Scoped invocation grant redemption is unauthenticated');
    let validate = (bindings: Readonly<ScopedInvocationGrantBindings>) =>
      d.envelope.grantId === bindings.grantId &&
      d.envelope.requestId === bindings.requestId &&
      bindings.expiresAtMs > this.now() &&
      !Object.entries(d.expected).some(([key, value]) => {
        if (value === undefined) return false;
        if (key === 'callbackSecretIds') {
          return JSON.stringify(bindings.callbackSecretIds) !== JSON.stringify(value);
        }
        if (key === 'candidateBindings' && bindings.operation !== 'tool_invoke') {
          return JSON.stringify(bindings.candidateBindings) !== JSON.stringify(value);
        }
        return (bindings as unknown as Record<string, unknown>)[key] !== value;
      });
    let bindings: Readonly<ScopedInvocationGrantBindings> | null;
    if (this.store) {
      bindings = await this.store.consume({
        tokenHash: grantTokenHash(d.envelope.token),
        now: new Date(this.now()),
        validate
      });
    } else {
      let grant = this.grants.get(d.envelope.token);
      this.grants.delete(d.envelope.token);
      bindings = grant?.bindings ?? null;
    }
    if (!bindings || !validate(bindings)) {
      throw new Error('Scoped invocation grant is missing, invalid, or already consumed');
    }
    return bindings;
  }

  async revoke(envelope: SlatesScopedInvocationGrantEnvelope) {
    this.grants.delete(envelope.token);
    await this.store?.revoke({
      tokenHash: grantTokenHash(envelope.token),
      now: new Date(this.now())
    });
  }

  release(d: {
    handle: ScopedInvocationAuthorityHandle;
    request: ScopedInvocationGrantRequest;
  }) {
    this.purgeExpiredResolutions();
    let resolution = this.resolutions.get(d.handle.token);
    let terminal = this.terminalResolutions.get(d.handle.token);
    let authoritative = resolution ?? terminal;
    if (
      !authoritative ||
      d.handle.version !== 'scoped_invocation_authority_v1' ||
      authoritative.id !== d.handle.id ||
      !sameRequest(authoritative.request, d.request)
    ) {
      throw new Error('Scoped invocation authority release binding validation failed');
    }
    this.resolutions.delete(d.handle.token);
    this.terminalResolutions.set(
      d.handle.token,
      Object.freeze({
        id: authoritative.id,
        request: authoritative.request,
        expiresAtMs:
          'expiresAtMs' in authoritative
            ? authoritative.expiresAtMs
            : this.now() + this.resolutionTtlMs
      })
    );
  }

  get pendingCount() {
    this.purgeExpiredResolutions();
    return this.grants.size + this.resolutions.size;
  }

  get resolutionCount() {
    this.purgeExpiredResolutions();
    return this.resolutions.size;
  }
}

export interface AcceptedWebhookVerificationBindings {
  proofId: string;
  tenantId: string;
  slateInstanceId: string;
  receiverId: string;
  receiverTriggerId: string;
  actionId: string;
  specHash: string;
  ruleId: string;
  requestId: string;
  originalRequestHash: string;
  registrationGeneration: number;
  registrationVersion: number;
  itemAdapterId?: 'graph.body_value.v1';
  candidateBindings: readonly Readonly<ScopedWebhookCandidateBinding>[];
  issuedAtMs: number;
  expiresAtMs: number;
}

export interface AcceptedWebhookVerificationProof {
  version: 'accepted_webhook_verification_v1';
  proofId: string;
  token: string;
}

export class AcceptedWebhookVerificationProofAuthority {
  private readonly proofs = new Map<
    string,
    Readonly<{ token: string; bindings: Readonly<AcceptedWebhookVerificationBindings> }>
  >();

  constructor(private readonly now = () => Date.now()) {}

  issue(d: {
    bindings: Omit<
      AcceptedWebhookVerificationBindings,
      'proofId' | 'issuedAtMs' | 'expiresAtMs'
    >;
    ttlMs: number;
  }): AcceptedWebhookVerificationProof {
    if (
      d.ttlMs <= 0 ||
      d.bindings.originalRequestHash.length !== 64 ||
      d.bindings.specHash.length !== 64 ||
      d.bindings.registrationGeneration <= 0 ||
      d.bindings.registrationVersion <= 0 ||
      !d.bindings.tenantId ||
      !d.bindings.slateInstanceId ||
      !d.bindings.receiverId ||
      !d.bindings.receiverTriggerId ||
      !d.bindings.actionId ||
      !d.bindings.ruleId ||
      !d.bindings.requestId ||
      new Set(d.bindings.candidateBindings.map(candidate => candidate.candidateId)).size !==
        d.bindings.candidateBindings.length ||
      new Set(d.bindings.candidateBindings.map(candidate => candidate.index)).size !==
        d.bindings.candidateBindings.length ||
      (d.bindings.itemAdapterId === undefined) !==
        (d.bindings.candidateBindings.length === 0) ||
      d.bindings.candidateBindings.some(
        candidate =>
          !candidate.candidateId ||
          !Number.isInteger(candidate.index) ||
          candidate.index < 0 ||
          !/^[a-f0-9]{64}$/.test(candidate.bindingHash) ||
          candidate.deliveryIds.length === 0 ||
          new Set(candidate.deliveryIds).size !== candidate.deliveryIds.length ||
          candidate.deliveryIds.some(deliveryId => !deliveryId)
      )
    ) {
      throw new Error('Invalid accepted webhook verification proof bindings');
    }
    let proofId = randomUUID();
    let token = randomUUID();
    let issuedAtMs = this.now();
    let bindings = Object.freeze({
      ...d.bindings,
      proofId,
      issuedAtMs,
      expiresAtMs: issuedAtMs + d.ttlMs,
      candidateBindings: Object.freeze(
        d.bindings.candidateBindings.map(candidate =>
          Object.freeze({
            ...candidate,
            deliveryIds: Object.freeze([...candidate.deliveryIds])
          })
        )
      )
    });
    this.proofs.set(token, Object.freeze({ token, bindings }));
    return Object.freeze({ version: 'accepted_webhook_verification_v1', proofId, token });
  }

  consume(d: { proof: AcceptedWebhookVerificationProof; receiverTriggerId: string }) {
    let stored = this.proofs.get(d.proof.token);
    this.proofs.delete(d.proof.token);
    if (!stored) throw new Error('Accepted webhook verification proof is missing or consumed');
    if (
      stored.bindings.proofId !== d.proof.proofId ||
      stored.bindings.receiverTriggerId !== d.receiverTriggerId ||
      stored.bindings.expiresAtMs <= this.now()
    ) {
      throw new Error('Accepted webhook verification proof binding validation failed');
    }
    return stored.bindings;
  }

  revoke(proof: AcceptedWebhookVerificationProof) {
    this.proofs.delete(proof.token);
  }

  get pendingCount() {
    return this.proofs.size;
  }
}
