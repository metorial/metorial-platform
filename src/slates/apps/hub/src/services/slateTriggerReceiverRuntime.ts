import { notFoundError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { createHash, randomUUID } from 'node:crypto';
import {
  computeWebhookActionSpecHashV1,
  SLATE_WEBHOOK_PROVIDER_VERIFIER_DEFINITIONS,
  slatesWebhookHttp
} from '@slates/proto';
import {
  SlateTriggerEventDeliveryStatus,
  SlateTriggerEventInputStatus,
  SlateTriggerInvocationType,
  SlateTriggerReceiverStatus,
  SlateTriggerReceiverTriggerSource,
  type SlateTriggerReceiverTrigger
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import {
  getReceiverWebhookBaseUrl,
  getTriggerWebhookBaseUrl,
  type TriggerWebhookRequestPayload
} from '../lib/triggerWebhook';
import {
  computeWebhookWireRequestHash as computeCanonicalWebhookWireRequestHash,
  parseWebhookWireRequest,
  type WebhookWireRequest
} from '../lib/webhookWire';
import type {
  ExactWebhookMappedOutput,
  ExactWebhookRuleBinding,
  GraphWebhookAuthorityBinding
} from '../lib/webhookVerification';
import {
  computeWebhookStateHash,
  executeExactWebhookPipeline,
  type ExactWebhookPipelineResult,
  type ExactWebhookTriggerProjection
} from '../lib/webhookVerification';
import {
  isTrustedSharedAppBoundary,
  type SharedAppAuthenticatedBoundary
} from '../lib/sharedAppRouting';
import {
  canDeferRegistrationSecretForBootstrap,
  fulfilledWebhookTriggerProjections
} from '../lib/webhookProjectionPolicy';
import { redactWebhookHeaders, redactWebhookUrl } from '../lib/webhookRequestCapture';
import {
  slateTriggerEventInputArchiveQueue,
  slateTriggerEventProcessQueue,
  slateTriggerEventSendQueue,
  slateTriggerWebhookDispatchOutboxQueue
} from '../queues/trigger/eventQueues';
import { slateErrorService } from './slateError';
import { slateInvocationService } from './slateInvocation';
import { slateTriggerReceiverSecretService } from './slateTriggerReceiverSecret';
import {
  computeHubSignalRequestFingerprint,
  slateTriggerWebhookReplayService
} from './slateTriggerWebhookReplay';
import {
  REGISTRATION_ATTEMPT_LEASE_MS,
  registrationFailureError,
  safeRegistrationFailure,
  slateTriggerRegistrationLifecycleService,
  type RegistrationAttemptClaim
} from './slateTriggerRegistrationLifecycle';
import type { SlateTriggerReceiverCore } from './slateTriggerReceiverCore';
import type {
  AuthoritativeWebhookResolution,
  AuthoritativeWebhookRegistration,
  AuthoritativeWebhookRule
} from './slateTriggerReceiverCore';
import {
  getTriggerSpec,
  isRoutableWebhookReceiverTrigger,
  receiverInclude,
  receiverTriggerInclude,
  webhookTriggerAllowsMethod,
  type ReceiverTriggerWithRelations,
  type WebhookHttpResponse
} from './slateTriggerReceiverShared';
import {
  resolveActiveSlateProvisionedAppRoute,
  resolveActiveSlateProvisionedTenantApp
} from './slateTriggerReceiverSecretProjection';

let Sentry = getSentry();

let TELEGRAM_ALLOWED_UPDATES_BY_ACTION: Readonly<Record<string, readonly string[]>> = {
  callback_query_received: ['callback_query'],
  chat_boost_updated: ['chat_boost', 'removed_chat_boost'],
  chat_member_updated: ['my_chat_member', 'chat_member', 'chat_join_request'],
  inline_query_received: ['inline_query', 'chosen_inline_result'],
  message_received: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],
  payment_received: ['shipping_query', 'pre_checkout_query', 'purchased_paid_media'],
  poll_updated: ['poll', 'poll_answer'],
  reaction_updated: ['message_reaction', 'message_reaction_count']
};

let TELEGRAM_WEBHOOK_LEASE_MS = 60_000;
let telegramWebhookSecretFingerprint = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

type TelegramWebhookMutationLease = {
  receiverOid: bigint;
  receiverId: string;
  token: string;
  mutationVersion: number;
  generation: number;
  remoteKnown: boolean;
  refCount: number;
  allowedUpdates: string[];
  webhookUrl: string | null;
  secretFingerprint: string | null;
};

export let claimTelegramWebhookMutationLease = async (
  receiverId: string,
  now = new Date()
): Promise<TelegramWebhookMutationLease> => {
  let current = await db.slateTriggerReceiver.findUniqueOrThrow({
    where: { id: receiverId },
    select: {
      oid: true,
      id: true,
      telegramWebhookMutationVersion: true,
      telegramWebhookGeneration: true,
      telegramWebhookRemoteKnown: true,
      telegramWebhookRefCount: true,
      telegramWebhookAllowedUpdates: true,
      telegramWebhookUrl: true,
      telegramWebhookSecretFingerprint: true
    }
  });
  let token = randomUUID();
  let claimed = await db.slateTriggerReceiver.updateMany({
    where: {
      oid: current.oid,
      telegramWebhookMutationVersion: current.telegramWebhookMutationVersion,
      OR: [
        { telegramWebhookLeaseToken: null },
        { telegramWebhookLeaseExpiresAt: { lte: now } }
      ]
    },
    data: {
      telegramWebhookLeaseToken: token,
      telegramWebhookLeaseExpiresAt: new Date(now.getTime() + TELEGRAM_WEBHOOK_LEASE_MS),
      telegramWebhookMutationVersion: { increment: 1 }
    }
  });
  if (claimed.count !== 1) throw new Error('telegram_webhook_lease_busy');
  return {
    receiverOid: current.oid,
    receiverId: current.id,
    token,
    mutationVersion: current.telegramWebhookMutationVersion + 1,
    generation: current.telegramWebhookGeneration,
    remoteKnown: current.telegramWebhookRemoteKnown,
    refCount: current.telegramWebhookRefCount,
    allowedUpdates: [...current.telegramWebhookAllowedUpdates],
    webhookUrl: current.telegramWebhookUrl,
    secretFingerprint: current.telegramWebhookSecretFingerprint
  };
};

export let isTelegramWebhookMutationLeaseCurrent = async (
  lease: TelegramWebhookMutationLease,
  referenceConstraint?: 'non_final' | 'final'
) =>
  Boolean(
    await db.slateTriggerReceiver.findFirst({
      where: {
        oid: lease.receiverOid,
        telegramWebhookLeaseToken: lease.token,
        telegramWebhookMutationVersion: lease.mutationVersion,
        telegramWebhookGeneration: lease.generation,
        ...(referenceConstraint ? { telegramWebhookRemoteKnown: true } : {}),
        ...(referenceConstraint === 'non_final'
          ? { telegramWebhookRefCount: { gt: 1 } }
          : referenceConstraint === 'final'
            ? { telegramWebhookRefCount: { lte: 1 } }
            : {})
      },
      select: { oid: true }
    })
  );

export let releaseTelegramWebhookMutationLease = async (
  lease: TelegramWebhookMutationLease
) => {
  await db.slateTriggerReceiver.updateMany({
    where: {
      oid: lease.receiverOid,
      telegramWebhookLeaseToken: lease.token,
      telegramWebhookMutationVersion: lease.mutationVersion
    },
    data: { telegramWebhookLeaseToken: null, telegramWebhookLeaseExpiresAt: null }
  });
};

let withTelegramWebhookMutationLease = async <Result>(
  receiverId: string,
  run: (lease: TelegramWebhookMutationLease) => Promise<Result>
) => {
  let lease = await claimTelegramWebhookMutationLease(receiverId);
  try {
    return await run(lease);
  } finally {
    await releaseTelegramWebhookMutationLease(lease);
  }
};

let isTelegramReceiver = (receiverTrigger: ReceiverTriggerWithRelations) =>
  receiverTrigger.receiver.slate.slateIdentifierOnRegistry === 'telegram' ||
  receiverTrigger.receiver.slate.slateIdOnRegistry === 'telegram';

let telegramAllowedUpdates = (
  receiverTrigger: ReceiverTriggerWithRelations,
  excludeTriggerId?: string
) =>
  [
    ...new Set(
      receiverTrigger.receiver.triggers
        .filter(
          trigger =>
            trigger.id !== excludeTriggerId &&
            !trigger.tombstonedAt &&
            trigger.registrationStatus !== 'unregistered' &&
            trigger.registrationStatus !== 'unregistering'
        )
        .flatMap(trigger => TELEGRAM_ALLOWED_UPDATES_BY_ACTION[trigger.action.key] ?? [])
    )
  ].sort();

type TelegramDetachReservation = {
  mutationId: string;
  generation: number;
  final: boolean;
  refCount: number;
  allowedUpdates: string[];
  remoteApplied: boolean;
  completed: boolean;
  leader: { id: string; actionId: string } | null;
};

export let collectGraphAuthorityRecords = (
  value: unknown,
  registrationGeneration: number,
  specHash: string,
  secrets: readonly { name: string; value: string }[],
  depth = 0
): GraphWebhookAuthorityBinding[] => {
  if (depth > 8 || value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value
      .slice(0, 1000)
      .flatMap(entry =>
        collectGraphAuthorityRecords(
          entry,
          registrationGeneration,
          specHash,
          secrets,
          depth + 1
        )
      );
  }
  let record = value as Record<string, unknown>;
  let secretName =
    typeof record.clientStateSecretName === 'string'
      ? record.clientStateSecretName
      : typeof record.clientStateSecretRef === 'string'
        ? record.clientStateSecretRef
        : undefined;
  let clientState = secretName
    ? secrets.find(secret => secret.name === secretName)?.value
    : typeof record.clientState === 'string'
      ? record.clientState
      : undefined;
  let validUntil =
    typeof record.validUntil === 'string' ? Date.parse(record.validUntil) : undefined;
  let own =
    typeof record.subscriptionId === 'string' &&
    typeof clientState === 'string' &&
    (validUntil === undefined || (Number.isFinite(validUntil) && validUntil >= Date.now()))
      ? [
          {
            subscriptionId: record.subscriptionId,
            clientState,
            ...(typeof record.resource === 'string' ? { resource: record.resource } : {}),
            registrationGeneration,
            specHash
          }
        ]
      : [];
  return [
    ...own,
    ...Object.values(record)
      .slice(0, 1000)
      .flatMap(entry =>
        collectGraphAuthorityRecords(
          entry,
          registrationGeneration,
          specHash,
          secrets,
          depth + 1
        )
      )
  ];
};

export type HubWebhookWireRequest = WebhookWireRequest;

export type HubWebhookItemAdapter = {
  id: 'graph.body_value.v1';
  candidates: Array<{
    candidateId: string;
    index: number;
    bindingHash: string;
    deliveryIds: string[];
  }>;
};

export type HubWebhookProviderRule = {
  id: string;
  phase: 'bootstrap' | 'delivery' | 'lifecycle';
  result:
    | { type: 'sync_only' }
    | { type: 'dispatch'; scope: 'receiver_trigger' | 'verified_items' };
  verify: {
    type: 'provider';
    verifierId: keyof typeof SLATE_WEBHOOK_PROVIDER_VERIFIER_DEFINITIONS;
    allowedSecretRefs: string[];
    allowedBootstrapCaptureRefs?: string[];
  };
};

export type HubWebhookVerifyOutput =
  | {
      status: 'accepted';
      selection:
        | { scope: 'receiver_trigger' }
        | {
            scope: 'verified_items';
            itemAdapterId: 'graph.body_value.v1';
            acceptedCandidateIds: string[];
          };
      presetFields?: Readonly<Record<string, string>>;
    }
  | { status: 'rejected'; code: string };

let SAFE_REJECTION_CODES = new Set([
  'baseline_path_missing',
  'baseline_path_invalid',
  'wire_input_malformed',
  'wire_input_oversized',
  'security_header_ambiguous',
  'no_matching_rule',
  'ambiguous_rule',
  'conflicting_rule_outcomes',
  'conflicting_sync_responses',
  'credential_missing',
  'credential_invalid',
  'credential_stale',
  'credential_future',
  'provider_timeout',
  'provider_error',
  'provider_invalid_result',
  'item_adapter_unknown',
  'item_adapter_invalid',
  'item_candidate_unknown',
  'item_candidate_duplicate',
  'item_candidate_contradictory',
  'replay_duplicate',
  'replay_conflict',
  'mapped_output_invalid',
  'mapped_output_incomplete',
  'mapped_output_extra',
  'state_cas_conflict',
  'routing_projection_unavailable',
  'routing_projection_stale'
]);

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let isCanonicalBase64 = (value: unknown): value is string =>
  typeof value === 'string' && Buffer.from(value, 'base64').toString('base64') === value;

let isWebhookWireResponse = (value: unknown) => {
  if (!isRecord(value)) return false;
  if (
    Object.keys(value).some(key => !['status', 'headers', 'body'].includes(key)) ||
    !Number.isInteger(value.status) ||
    (value.status as number) < 100 ||
    (value.status as number) > 599 ||
    !Array.isArray(value.headers) ||
    value.headers.some(
      header =>
        !Array.isArray(header) ||
        header.length !== 2 ||
        typeof header[0] !== 'string' ||
        typeof header[1] !== 'string'
    ) ||
    !isRecord(value.body)
  ) {
    return false;
  }
  return value.body.present === false
    ? Object.keys(value.body).length === 1
    : value.body.present === true &&
        Object.keys(value.body).length === 2 &&
        isCanonicalBase64(value.body.base64);
};

let isWebhookReplayClaim = (value: unknown) =>
  isRecord(value) &&
  Object.keys(value).every(key => ['deliveryIds', 'freshnessTimestampMs'].includes(key)) &&
  Array.isArray(value.deliveryIds) &&
  value.deliveryIds.every(id => typeof id === 'string' && id.length > 0) &&
  new Set(value.deliveryIds).size === value.deliveryIds.length &&
  (value.freshnessTimestampMs === undefined ||
    (Number.isInteger(value.freshnessTimestampMs) &&
      (value.freshnessTimestampMs as number) >= 0));

export let computeHubWebhookWireRequestHash = computeCanonicalWebhookWireRequestHash;

let WEBHOOK_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
] as const;

let canonicalizeJsonJcs = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JCS numbers must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJsonJcs).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalizeJsonJcs(value[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('JCS values must use the JSON data model');
};

/** Independent Hub adapter for the producer's v1 action-contract hashing algorithm. */
export let computeHubWebhookActionSpecHashV1 = (action: Record<string, any>) => {
  if (
    typeof action.id !== 'string' ||
    action.type !== 'action.trigger' ||
    !isRecord(action.capabilities) ||
    !isRecord(action.invocation) ||
    action.invocation.type !== 'webhook' ||
    typeof action.invocation.autoRegistration !== 'boolean' ||
    typeof action.invocation.autoUnregistration !== 'boolean'
  ) {
    throw new Error('Stored webhook action contract is invalid');
  }
  let http = isRecord(action.invocation.http) ? action.invocation.http : {};
  let methodSet = new Set(Array.isArray(http.methods) ? http.methods : WEBHOOK_HTTP_METHODS);
  let contract = {
    id: action.id,
    type: action.type,
    capabilities: action.capabilities,
    invocation: {
      type: action.invocation.type,
      autoRegistration: action.invocation.autoRegistration,
      autoUnregistration: action.invocation.autoUnregistration,
      http: {
        allowedMethods: WEBHOOK_HTTP_METHODS.filter(method => methodSet.has(method)),
        sync: http.sync,
        ingress: http.ingress
      }
    }
  };
  return createHash('sha256')
    .update(new TextEncoder().encode('metorial.webhook-action-spec\0v1\0'))
    .update(new TextEncoder().encode(canonicalizeJsonJcs(contract)))
    .digest('hex');
};

let validateCandidateBindings = (
  candidates: readonly {
    candidateId: string;
    index: number;
    bindingHash: string;
    deliveryIds: readonly string[];
  }[]
) => {
  if (
    new Set(candidates.map(candidate => candidate.candidateId)).size !== candidates.length ||
    new Set(candidates.map(candidate => candidate.index)).size !== candidates.length ||
    candidates.some(
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
    throw new Error('Authoritative webhook candidate bindings are invalid');
  }
};

let exactCandidateBindings = (first: readonly unknown[], second: readonly unknown[]) =>
  JSON.stringify(first) === JSON.stringify(second);

let validateExactBootstrapProposalBindings = (
  proof: import('../lib/invocation/types').AcceptedWebhookVerificationBindings,
  bindings: ExactWebhookRuleBinding
) =>
  proof.receiverId === bindings.receiverId &&
  proof.receiverTriggerId === bindings.receiverTriggerId &&
  proof.actionId === bindings.actionId &&
  proof.specHash === bindings.specHash &&
  proof.registrationGeneration === bindings.registrationGeneration &&
  proof.registrationVersion === bindings.registrationVersion &&
  proof.ruleId === bindings.ruleId &&
  proof.requestId === bindings.requestId &&
  proof.originalRequestHash === bindings.originalRequestHash &&
  bindings.dispatchRequestHash === bindings.originalRequestHash &&
  proof.itemAdapterId === bindings.itemAdapterId &&
  exactCandidateBindings(proof.candidateBindings, bindings.selectedItems);

export let validateBootstrapProposalAuthority = (d: {
  authority: AuthoritativeWebhookResolution;
  proof: import('../lib/invocation/types').AcceptedWebhookVerificationBindings;
  requestHash: string;
  hubInvocationId: string;
}) =>
  d.authority.rule.phase === 'bootstrap' &&
  d.authority.rule.result.type === 'sync_only' &&
  d.authority.rule.verify.type === 'provider' &&
  ['pending', 'registering'].includes(d.authority.registrationStatus) &&
  d.requestHash === d.proof.originalRequestHash &&
  d.authority.actionId === d.proof.actionId &&
  d.authority.specHash === d.proof.specHash &&
  d.authority.registrationGeneration === d.proof.registrationGeneration &&
  d.authority.registrationVersion === d.proof.registrationVersion &&
  d.authority.itemAdapterId === d.proof.itemAdapterId &&
  d.authority.hubInvocationId === d.hubInvocationId &&
  exactCandidateBindings(d.authority.candidateBindings, d.proof.candidateBindings);

let getWireBody = (request: HubWebhookWireRequest) =>
  request.body.present ? Buffer.from(request.body.base64, 'base64').toString('utf8') : '';

let getPathValue = (value: unknown, path: string) => {
  let parts = path
    .replace(/^\$\.?/, '')
    .replace(/^\//, '')
    .split(/[/.]/)
    .filter(Boolean);
  return parts.reduce<unknown>((current, part) => {
    if (Array.isArray(current)) {
      let index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    return isRecord(current) ? current[part] : undefined;
  }, value);
};

let ruleMatchesRequest = (d: {
  rule: AuthoritativeWebhookRule;
  request: HubWebhookWireRequest;
  registrationStatus: string;
}) => {
  if (!d.rule.when.methods.includes(d.request.method)) return false;
  if (
    d.rule.when.registrationStatuses &&
    !d.rule.when.registrationStatuses.includes(d.registrationStatus)
  )
    return false;
  let matcher = d.rule.when.matcher;
  if (!matcher) return true;
  if (matcher.method !== undefined && matcher.method !== d.request.method) return false;
  let headers = d.request.headers.filter(
    ([name]) =>
      typeof matcher.hasHeader === 'string' &&
      name.toLowerCase() === matcher.hasHeader.toLowerCase()
  );
  if (matcher.hasHeader !== undefined && headers.length === 0) return false;
  let url = new URL(d.request.url, 'https://webhook.invalid');
  if (
    typeof matcher.hasQueryParam === 'string' &&
    !url.searchParams.has(matcher.hasQueryParam)
  )
    return false;
  if (
    typeof matcher.lacksQueryParam === 'string' &&
    url.searchParams.has(matcher.lacksQueryParam)
  )
    return false;
  if (isRecord(matcher.jsonBodyField)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(getWireBody(d.request));
    } catch {
      return false;
    }
    let value = getPathValue(parsed, String(matcher.jsonBodyField.path));
    if (value === undefined) return false;
    if (
      matcher.jsonBodyField.equals !== undefined &&
      String(value) !== matcher.jsonBodyField.equals
    )
      return false;
  }
  if (isRecord(matcher.formBodyField)) {
    let form = new URLSearchParams(getWireBody(d.request));
    let path = String(matcher.formBodyField.path);
    if (!form.has(path)) return false;
    if (
      matcher.formBodyField.equals !== undefined &&
      form.get(path) !== matcher.formBodyField.equals
    )
      return false;
  }
  return true;
};

let validateAuthority = (d: {
  authority: AuthoritativeWebhookResolution;
  receiverTriggerId: string;
  ruleId: string;
  request: HubWebhookWireRequest;
}) => {
  let publishedHash = d.authority.actionContract.specHash;
  let computedHash = computeHubWebhookActionSpecHashV1(d.authority.actionContract);
  if (
    d.authority.receiverTrigger.id !== d.receiverTriggerId ||
    d.authority.rule.id !== d.ruleId ||
    d.authority.actionId !== d.authority.receiverTrigger.action.key ||
    typeof publishedHash !== 'string' ||
    publishedHash !== d.authority.specHash ||
    computedHash !== d.authority.specHash ||
    !Number.isInteger(d.authority.registrationGeneration) ||
    d.authority.registrationGeneration <= 0 ||
    !Number.isInteger(d.authority.registrationVersion) ||
    d.authority.registrationVersion <= 0 ||
    !ruleMatchesRequest({
      rule: d.authority.rule,
      request: d.request,
      registrationStatus: d.authority.registrationStatus
    })
  ) {
    throw new Error('Authoritative webhook binding validation failed');
  }
  validateCandidateBindings(d.authority.candidateBindings);
  if (
    (d.authority.itemAdapterId === undefined) !==
    (d.authority.candidateBindings.length === 0)
  ) {
    throw new Error('Authoritative webhook adapter binding is invalid');
  }
};

let validateRegistrationAuthority = (authority: AuthoritativeWebhookRegistration) => {
  let publishedHash = authority.actionContract.specHash;
  if (
    authority.receiverTrigger.action.key !== authority.actionId ||
    typeof publishedHash !== 'string' ||
    publishedHash !== authority.specHash ||
    computeHubWebhookActionSpecHashV1(authority.actionContract) !== authority.specHash ||
    !Number.isInteger(authority.registrationGeneration) ||
    authority.registrationGeneration <= 0 ||
    !Number.isInteger(authority.registrationVersion) ||
    authority.registrationVersion <= 0 ||
    new Set(authority.callbackSecretIds).size !== authority.callbackSecretIds.length ||
    authority.callbackSecretIds.some(id => !id)
  ) {
    throw new Error('Authoritative webhook registration binding validation failed');
  }
};

export let validateHubProviderWebhookResult = (d: {
  result: unknown;
  rule: HubWebhookProviderRule;
  itemAdapter?: HubWebhookItemAdapter;
}): HubWebhookVerifyOutput => {
  if (
    !isRecord(d.result) ||
    (d.result.status !== 'accepted' && d.result.status !== 'rejected')
  ) {
    throw new Error('Provider returned an invalid webhook verification discriminant');
  }
  if (d.result.status === 'rejected') {
    if (
      Object.keys(d.result).some(key => key !== 'status' && key !== 'code') ||
      typeof d.result.code !== 'string' ||
      !SAFE_REJECTION_CODES.has(d.result.code)
    ) {
      throw new Error('Provider returned a contradictory webhook rejection');
    }
    return d.result as HubWebhookVerifyOutput;
  }
  if (
    Object.keys(d.result).some(
      key => key !== 'status' && key !== 'selection' && key !== 'authenticatedFields'
    )
  ) {
    throw new Error('Provider returned a contradictory webhook acceptance');
  }
  let authenticatedFields = isRecord(d.result.authenticatedFields)
    ? d.result.authenticatedFields
    : {};
  let verifierDefinition =
    SLATE_WEBHOOK_PROVIDER_VERIFIER_DEFINITIONS[d.rule.verify.verifierId];
  if (!verifierDefinition) {
    throw new Error('Provider webhook verifier declaration is missing or unknown');
  }
  let allowedAuthenticatedFields = new Set(verifierDefinition.presetFields);
  if (
    Object.entries(authenticatedFields).some(
      ([key, value]) =>
        !allowedAuthenticatedFields.has(key as never) ||
        typeof value !== 'string' ||
        value.length === 0
    )
  ) {
    throw new Error('Provider returned an undeclared authenticated field');
  }
  if (!isRecord(d.result.selection)) {
    throw new Error('Provider webhook acceptance has no selection');
  }
  let expectedScope =
    d.rule.result.type === 'dispatch' ? d.rule.result.scope : 'receiver_trigger';
  if (d.result.selection.scope !== expectedScope) {
    throw new Error('Provider webhook selection contradicts the selected rule');
  }
  if (expectedScope === 'receiver_trigger') {
    if (Object.keys(d.result.selection).some(key => key !== 'scope')) {
      throw new Error('Receiver-trigger selection contains invalid siblings');
    }
    return {
      status: 'accepted',
      selection: d.result.selection as { scope: 'receiver_trigger' },
      ...(Object.keys(authenticatedFields).length > 0
        ? { presetFields: authenticatedFields as Record<string, string> }
        : {})
    };
  }
  if (
    d.result.selection.itemAdapterId !== 'graph.body_value.v1' ||
    d.itemAdapter?.id !== 'graph.body_value.v1' ||
    !Array.isArray(d.result.selection.acceptedCandidateIds) ||
    d.result.selection.acceptedCandidateIds.length === 0 ||
    d.result.selection.acceptedCandidateIds.some(id => typeof id !== 'string')
  ) {
    throw new Error('Provider webhook item adapter selection is invalid');
  }
  let selected = d.result.selection.acceptedCandidateIds as string[];
  if (new Set(selected).size !== selected.length) {
    throw new Error('Provider selected duplicate webhook candidates');
  }
  let candidates = new Set(d.itemAdapter.candidates.map(candidate => candidate.candidateId));
  if (selected.some(candidateId => !candidates.has(candidateId))) {
    throw new Error('Provider selected an unknown webhook candidate');
  }
  return {
    status: 'accepted',
    selection: d.result.selection as {
      scope: 'verified_items';
      itemAdapterId: 'graph.body_value.v1';
      acceptedCandidateIds: string[];
    },
    ...(Object.keys(authenticatedFields).length > 0
      ? { presetFields: authenticatedFields as Record<string, string> }
      : {})
  };
};

const MAX_TRIGGER_EVENT_INPUT_ATTEMPTS = 5;
const MAX_WEBHOOK_INVOCATION_PAYLOAD_BYTES = 4 * 1024 * 1024;
const ARCHIVE_INPUT_STATUSES = new Set<SlateTriggerEventInputStatus>([
  SlateTriggerEventInputStatus.succeeded,
  SlateTriggerEventInputStatus.failed,
  SlateTriggerEventInputStatus.skipped
]);

let getWebhookInvocationPayloadBytes = (d: {
  actionId: string;
  request: TriggerWebhookRequestPayload;
  state: any;
  registrationDetails: any;
}) =>
  Buffer.byteLength(
    JSON.stringify({
      actionId: d.actionId,
      url: d.request.url,
      method: d.request.method,
      headers: d.request.headers,
      body: d.request.body ?? null,
      state: d.state,
      registrationDetails: d.registrationDetails
    })
  );

let getWebhookLifecycleInput = (request: TriggerWebhookRequestPayload) => {
  let pathSecret = (() => {
    try {
      let parts = new URL(request.url).pathname.split('/').filter(Boolean);
      let routeIndex = parts.findIndex(
        part => part === 'webhook' || part === 'receiver-webhook'
      );
      return routeIndex >= 0 && parts.length > routeIndex + 2
        ? decodeURIComponent(parts[routeIndex + 2]!)
        : undefined;
    } catch {
      return undefined;
    }
  })();
  let body = request.body ? Buffer.from(request.body.content, 'base64') : null;
  return {
    url: redactWebhookUrl(request.url, pathSecret),
    method: request.method,
    headers: redactWebhookHeaders(Object.entries(request.headers)),
    body: body
      ? {
          redacted: true,
          byteLength: body.byteLength,
          sha256: createHash('sha256').update(body).digest('hex')
        }
      : null,
    receivedAt: new Date().toISOString()
  };
};

export class RegistrationLeaseLostError extends Error {
  constructor() {
    super('Registration lease ownership was lost');
    this.name = 'RegistrationLeaseLostError';
  }
}

export class SlateTriggerReceiverRuntime {
  private readonly core: SlateTriggerReceiverCore;

  constructor(core: SlateTriggerReceiverCore) {
    this.core = core;
  }

  private async getSecuredWebhookBaseUrl(
    receiverTrigger: ReceiverTriggerWithRelations,
    route: 'trigger' | 'receiver' = 'trigger'
  ) {
    let pathSecrets = await slateTriggerReceiverSecretService.resolvePathActiveAndRetiring({
      tenant: receiverTrigger.receiver.tenant,
      receiverId: receiverTrigger.receiver.id
    });
    let activePath = pathSecrets[0];
    if (!activePath) throw new Error('credential_missing');
    let baseUrl =
      route === 'receiver'
        ? getReceiverWebhookBaseUrl(receiverTrigger.receiver.id)
        : getTriggerWebhookBaseUrl(receiverTrigger.id);
    return `${baseUrl}/${encodeURIComponent(activePath.plaintext)}`;
  }

  /// Route lookup is unauthenticated discovery. Tenant-app binding resolution
  /// requires the vendor-proof-derived ownership key.
  async resolveProvisionedAppRoute(routeIdentifier: string) {
    return await resolveActiveSlateProvisionedAppRoute({ routeIdentifier });
  }

  async resolveProvisionedTenantAppBinding(d: {
    routeIdentityId: string;
    authenticatedExternalOwnershipKey: string;
  }) {
    return await resolveActiveSlateProvisionedTenantApp(d);
  }

  private async withRegistrationLease<T>(
    claim: RegistrationAttemptClaim,
    operation: (assertOwned: () => void) => Promise<T>
  ) {
    try {
      if (!(await slateTriggerRegistrationLifecycleService.renewLease(claim))) {
        throw new RegistrationLeaseLostError();
      }
    } catch (error) {
      if (error instanceof RegistrationLeaseLostError) throw error;
      throw new RegistrationLeaseLostError();
    }
    let lost = false;
    let renewing = false;
    let rejectLeaseLoss: (error: RegistrationLeaseLostError) => void = () => {};
    let leaseLoss = new Promise<never>((_, reject) => {
      rejectLeaseLoss = reject;
    });
    let markLost = () => {
      if (lost) return;
      lost = true;
      rejectLeaseLoss(new RegistrationLeaseLostError());
    };
    let assertOwned = () => {
      if (lost) throw new RegistrationLeaseLostError();
    };
    let renew = async () => {
      try {
        if (!(await slateTriggerRegistrationLifecycleService.renewLease(claim))) markLost();
      } catch {
        markLost();
      }
    };
    let heartbeat = setInterval(
      () => {
        if (renewing) return;
        renewing = true;
        void renew().finally(() => {
          renewing = false;
        });
      },
      Math.floor(REGISTRATION_ATTEMPT_LEASE_MS / 3)
    );
    try {
      return await Promise.race([operation(assertOwned), leaseLoss]);
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async projectExactWebhookTrigger(
    receiverTrigger: ReceiverTriggerWithRelations,
    sharedBoundary?: SharedAppAuthenticatedBoundary
  ): Promise<ExactWebhookTriggerProjection> {
    let actionContract = receiverTrigger.action.spec as Record<string, any>;
    let publishedHash = actionContract.specHash;
    if (
      typeof publishedHash !== 'string' ||
      publishedHash !== computeWebhookActionSpecHashV1(actionContract as never)
    ) {
      throw new Error('Published webhook action contract hash is invalid');
    }
    let http = slatesWebhookHttp.parse(actionContract.invocation?.http ?? {});
    let ingress = http.ingress;
    if (
      (sharedBoundary && !ingress) ||
      (ingress && ingress.kind !== (sharedBoundary?.kind ?? 'receiver_route'))
    ) {
      throw new Error('Webhook ingress projection does not match its authenticated boundary');
    }
    let verification =
      ingress?.verification ??
      ({
        mechanism: 'path_secret_only',
        baseline: 'receiver_path_secret',
        reason:
          'No provider verification policy is declared; the receiver path secret is the authentication boundary.'
      } as const);
    if (sharedBoundary) {
      if (
        !ingress ||
        !isTrustedSharedAppBoundary(sharedBoundary) ||
        sharedBoundary.receiverId !== receiverTrigger.receiver.id ||
        sharedBoundary.receiverTriggerId !== receiverTrigger.id ||
        sharedBoundary.receiverGeneration !== receiverTrigger.registrationGeneration ||
        sharedBoundary.triggerActionId !== receiverTrigger.action.key ||
        sharedBoundary.specHash !== publishedHash ||
        ingress.kind !== 'shared_provisioned_app' ||
        ingress.routeFamily !== sharedBoundary.vendor ||
        ingress.verification.mechanism !== 'hub' ||
        ingress.verification.rules.some(
          rule => rule.verify.type !== 'preset' || rule.verify.preset !== sharedBoundary.preset
        )
      ) {
        throw new Error('Shared-app authenticated authority is stale or mismatched');
      }
    }
    if (
      receiverTrigger.verificationSpecHash !== publishedHash ||
      receiverTrigger.verificationMechanism !== verification.mechanism
    ) {
      await slateTriggerRegistrationLifecycleService.reconcileVerificationDeclaration({
        receiverTriggerId: receiverTrigger.id,
        expectedRegistrationGeneration: receiverTrigger.registrationGeneration,
        expectedSpecHash: receiverTrigger.verificationSpecHash
      });
      throw new Error('Authoritative webhook verification policy is blocked');
    }
    if (!isRoutableWebhookReceiverTrigger(receiverTrigger)) {
      throw new Error('Authoritative webhook verification policy is blocked');
    }
    let secretRefs =
      verification.mechanism === 'path_secret_only' ? [] : verification.allowedSecretRefs;
    let secretNames = secretRefs.map(secretRef => secretRef.name);
    let secrets = sharedBoundary
      ? [...sharedBoundary.vendorSecrets]
      : (
          await Promise.all(
            secretNames.map(async name => {
              try {
                return await slateTriggerReceiverSecretService.resolveDeclaredTriggerSecretsForVerification(
                  {
                    receiverTriggerId: receiverTrigger.id,
                    name
                  }
                );
              } catch (error) {
                let secretRef = secretRefs.find(ref => ref.name === name);
                if (
                  error instanceof Error &&
                  error.message === 'credential_missing' &&
                  secretRef &&
                  canDeferRegistrationSecretForBootstrap({
                    registrationStatus: receiverTrigger.registrationStatus,
                    secretRef,
                    rules:
                      verification.mechanism === 'path_secret_only' ? [] : verification.rules
                  })
                ) {
                  return [];
                }
                throw error;
              }
            })
          )
        ).flat();
    let stateVersion = receiverTrigger.registrationVersion;
    let requiresGraphAuthority =
      verification.mechanism !== 'path_secret_only' &&
      verification.rules.some(
        rule =>
          (rule.verify.type === 'preset' &&
            rule.verify.preset === 'graph.change_notification.v1') ||
          (rule.verify.type === 'provider' &&
            rule.verify.verifierId === 'graph.change_notification.provider.v1')
      );
    let graphAuthorities = requiresGraphAuthority
      ? collectGraphAuthorityRecords(
          await slateTriggerReceiverSecretService.resolveRegistrationDetails({
            receiverTriggerId: receiverTrigger.id
          }),
          receiverTrigger.registrationGeneration,
          publishedHash,
          secrets
        )
      : [];
    return {
      receiverId: receiverTrigger.receiver.id,
      receiverTriggerId: receiverTrigger.id,
      actionId: receiverTrigger.action.key,
      specHash: publishedHash,
      registrationStatus: receiverTrigger.registrationStatus,
      registrationGeneration: receiverTrigger.registrationGeneration,
      registrationVersion: receiverTrigger.registrationVersion,
      verification,
      secrets,
      actionInputSchema: (actionContract.inputSchema ?? {}) as Record<string, unknown>,
      state: receiverTrigger.state,
      stateVersion,
      stateHash: computeWebhookStateHash(receiverTrigger.state),
      ...(requiresGraphAuthority ? { graphAuthorities } : {}),
      ...(sharedBoundary
        ? {
            sharedAppAuthority: {
              routeProjectionId: sharedBoundary.routeIdentityId,
              routeGeneration: sharedBoundary.routeGeneration,
              routeProjectionDigest: sharedBoundary.routeDigest,
              bindingProjectionId: sharedBoundary.bindingIdentityId,
              bindingGeneration: sharedBoundary.bindingGeneration,
              bindingProjectionDigest: sharedBoundary.bindingDigest,
              externalOwnershipKey: sharedBoundary.externalOwnershipKey,
              authenticatedPathSecretIds: sharedBoundary.authenticatedPathSecretIds,
              authenticatedVendorSecretIds: sharedBoundary.authenticatedVendorSecretIds,
              bindingHash: sharedBoundary.bindingHash
            }
          }
        : {})
    };
  }

  private async executeCapturedExactWebhook(d: {
    receiverId: string;
    requestId: string;
    request: HubWebhookWireRequest;
    receiverTriggers: ReceiverTriggerWithRelations[];
    sharedBoundary?: SharedAppAuthenticatedBoundary;
  }): Promise<ExactWebhookPipelineResult> {
    let verificationProofs = new Map<
      string,
      import('../lib/invocation/types').AcceptedWebhookVerificationProof
    >();
    let projectionResults = await Promise.allSettled(
      d.receiverTriggers.map(trigger =>
        this.projectExactWebhookTrigger(trigger, d.sharedBoundary)
      )
    );
    let triggers = fulfilledWebhookTriggerProjections(projectionResults);
    if (triggers.length === 0) {
      return { status: 'rejected', code: 'routing_projection_unavailable' };
    }

    return await executeExactWebhookPipeline({
      receiverId: d.receiverId,
      requestId: d.requestId,
      request: d.request,
      // A stale or misconfigured sibling must not make otherwise healthy receiver routes
      // unavailable. Exact trigger routes still fail closed because they contain one projection.
      triggers,
      dependencies: {
        lookupReplay: async input =>
          await slateTriggerWebhookReplayService.lookupBeforeMapping(input),
        verifyProvider: async ({ trigger, rule, request, requestId, itemAdapter }) => {
          let result = await this.verifyProviderWebhook({
            receiverTriggerId: trigger.receiverTriggerId,
            request,
            ruleId: rule.id,
            requestId,
            itemAdapter: itemAdapter
              ? {
                  id: itemAdapter.id,
                  candidates: itemAdapter.candidates.map(candidate => ({
                    ...candidate,
                    deliveryIds: [...candidate.deliveryIds]
                  }))
                }
              : undefined
          });
          if (result.status !== 'verified') {
            throw new Error('Provider webhook verification capability is unavailable');
          }
          if (result.acceptedProof) {
            verificationProofs.set(trigger.receiverTriggerId, result.acceptedProof);
          }
          return result.result;
        },
        mapProvider: async ({ trigger, rule, request, bindings, stateVersion, stateHash }) =>
          await this.mapVerifiedWebhookRequest({
            receiverTriggerId: trigger.receiverTriggerId,
            ruleId: rule.id,
            originalRequest: d.request,
            dispatchRequest: request,
            bindings,
            expectedStateVersion: stateVersion,
            expectedStateHash: stateHash
          }),
        captureBootstrap: async ({ trigger, bindings }) => {
          let proof = verificationProofs.get(trigger.receiverTriggerId);
          if (!proof) throw new Error('Accepted bootstrap verification proof is unavailable');
          return await this.proposeProviderWebhookBootstrap({
            receiverTriggerId: trigger.receiverTriggerId,
            proof,
            request: d.request,
            bindings,
            requestId: d.requestId
          });
        },
        atomicCommit: slateTriggerWebhookReplayService
      }
    });
  }

  async verifyProviderWebhook(d: {
    receiverTriggerId: string;
    request: HubWebhookWireRequest;
    ruleId: string;
    requestId?: string;
    itemAdapter?: HubWebhookItemAdapter;
  }): Promise<
    | { status: 'legacy_fallback' }
    | {
        status: 'verified';
        result: HubWebhookVerifyOutput;
        invocation: { oid: bigint };
        acceptedProof?: import('../lib/invocation/types').AcceptedWebhookVerificationProof;
      }
  > {
    let resolver = this.core.security.webhookAuthorityResolver;
    if (!resolver) throw new Error('Authoritative webhook resolution is unavailable');
    let hubInvocationId = getId('slateInvocation').id;
    let requestId = d.requestId ?? randomUUID();
    let resolved = await resolver.resolve({
      receiverTriggerId: d.receiverTriggerId,
      ruleId: d.ruleId,
      request: d.request,
      hubInvocationId,
      requestId,
      operation: 'webhook_verify',
      itemAdapterId: d.itemAdapter?.id,
      candidateBindings: d.itemAdapter?.candidates
    });
    let { authority, authorityHandle } = resolved;
    try {
      validateAuthority({
        authority,
        receiverTriggerId: d.receiverTriggerId,
        ruleId: d.ruleId,
        request: d.request
      });
      if (authority.rule.verify.type !== 'provider') {
        throw new Error('Authoritative provider webhook rule is invalid');
      }
      if (authority.hubInvocationId !== hubInvocationId) {
        throw new Error('Authoritative webhook invocation binding is invalid');
      }
      let originalRequestHash = computeHubWebhookWireRequestHash(d.request);
      if (
        !Array.isArray(d.request.headers) ||
        d.request.headers.some(
          header =>
            !Array.isArray(header) ||
            header.length !== 2 ||
            typeof header[0] !== 'string' ||
            typeof header[1] !== 'string'
        ) ||
        (d.request.body.present &&
          Buffer.from(d.request.body.base64, 'base64').toString('base64') !==
            d.request.body.base64)
      ) {
        throw new Error('Webhook wire request is malformed');
      }

      let capabilities = await this.core.negotiateWebhookCapabilities({
        receiverTrigger: authority.receiverTrigger,
        version: authority.version
      });
      // This is the only legacy transition. Route presence is deliberately irrelevant.
      if (capabilities.verification.status === 'legacy') {
        return { status: 'legacy_fallback' };
      }
      if (capabilities.verification.status === 'fail_closed') {
        throw new Error(capabilities.verification.code);
      }
      let issuer = this.core.security.scopedGrantIssuer;
      let redeemer = this.core.security.scopedGrantRedeemer;
      // An advertised secret-bearing operation may not silently downgrade when authenticated
      // grant issue/redemption is unavailable.
      if (!issuer || !redeemer) {
        throw new Error('Authenticated scoped invocation grant issuance is unavailable');
      }

      let envelope = await issuer.issue({
        authorityHandle,
        receiverTriggerId: authority.receiverTrigger.id,
        hubInvocationId,
        requestId,
        operation: 'webhook_verify'
      });
      try {
        let redemption = await redeemer.redeem({
          envelope,
          expected: {
            requestId,
            operation: 'webhook_verify',
            actionId: authority.actionId
          },
          secrets: authority.scopedSecrets
        });
        let stack = await this.core.createRestrictedInvocationStack({
          receiverTrigger: authority.receiverTrigger,
          version: authority.version,
          hubInvocationId,
          redactionSentinels: authority.redactionSentinels,
          forbiddenValues: [
            envelope.grantId,
            envelope.token,
            authorityHandle.id,
            authorityHandle.token
          ],
          redemption
        });
        let itemAdapter = authority.itemAdapterId
          ? {
              id: authority.itemAdapterId,
              candidates: authority.candidateBindings.map(candidate => ({
                ...candidate,
                deliveryIds: [...candidate.deliveryIds]
              }))
            }
          : undefined;
        let result = await slateInvocationService.verifyWebhookRequest({
          stack,
          invocation: envelope,
          input: {
            actionId: authority.actionId,
            specHash: authority.specHash,
            ruleId: authority.rule.id,
            requestId,
            originalRequest: d.request,
            originalRequestHash,
            itemAdapter
          }
        });
        if (result.status === 'error') throw new Error(result.error.message);
        let verified = validateHubProviderWebhookResult({
          result: result.data,
          rule: authority.rule as unknown as HubWebhookProviderRule,
          itemAdapter
        });
        let acceptedProof:
          | import('../lib/invocation/types').AcceptedWebhookVerificationProof
          | undefined;
        if (
          verified.status === 'accepted' &&
          authority.rule.phase === 'bootstrap' &&
          authority.rule.result.type === 'sync_only'
        ) {
          let proofs = this.core.security.acceptedVerificationProofs;
          if (!proofs) throw new Error('Accepted verification proof authority is unavailable');
          let acceptedIds =
            verified.selection.scope === 'verified_items'
              ? verified.selection.acceptedCandidateIds
              : undefined;
          let selectedBindings = acceptedIds
            ? authority.candidateBindings.filter(candidate =>
                acceptedIds.includes(candidate.candidateId)
              )
            : authority.candidateBindings;
          acceptedProof = proofs.issue({
            bindings: {
              tenantId: authority.receiverTrigger.receiver.tenant.id,
              slateInstanceId: authority.receiverTrigger.receiver.slateInstance.id,
              receiverId: authority.receiverTrigger.receiver.id,
              receiverTriggerId: authority.receiverTrigger.id,
              actionId: authority.actionId,
              specHash: authority.specHash,
              ruleId: authority.rule.id,
              requestId,
              originalRequestHash,
              registrationGeneration: authority.registrationGeneration,
              registrationVersion: authority.registrationVersion,
              itemAdapterId: authority.itemAdapterId,
              candidateBindings: selectedBindings
            },
            ttlMs: 60_000
          });
        }
        return {
          status: 'verified',
          result: verified,
          invocation: result.invocation,
          ...(acceptedProof ? { acceptedProof } : {})
        };
      } finally {
        await issuer.revoke(envelope);
      }
    } finally {
      await resolver.release({
        authorityHandle,
        receiverTriggerId: d.receiverTriggerId,
        hubInvocationId,
        requestId,
        operation: 'webhook_verify'
      });
    }
  }

  async mapVerifiedWebhookRequest(d: {
    receiverTriggerId: string;
    ruleId: string;
    originalRequest: HubWebhookWireRequest;
    dispatchRequest: HubWebhookWireRequest;
    bindings: ExactWebhookRuleBinding;
    expectedStateVersion: number;
    expectedStateHash: string;
  }): Promise<ExactWebhookMappedOutput> {
    let resolver = this.core.security.webhookAuthorityResolver;
    let issuer = this.core.security.scopedGrantIssuer;
    let redeemer = this.core.security.scopedGrantRedeemer;
    if (!resolver?.resolveMapping || !issuer || !redeemer) {
      throw new Error('Scoped webhook mapping authority is unavailable');
    }
    let hubInvocationId = getId('slateInvocation').id;
    let requestId = d.bindings.requestId;
    let resolved = await resolver.resolveMapping({
      receiverTriggerId: d.receiverTriggerId,
      ruleId: d.ruleId,
      originalRequest: d.originalRequest,
      dispatchRequest: d.dispatchRequest,
      originalRequestHash: d.bindings.originalRequestHash,
      dispatchRequestHash: d.bindings.dispatchRequestHash,
      hubInvocationId,
      requestId,
      operation: 'webhook_handle',
      itemAdapterId: d.bindings.itemAdapterId,
      candidateBindings: d.bindings.selectedItems
    });
    let { authority, authorityHandle } = resolved;
    try {
      validateAuthority({
        authority,
        receiverTriggerId: d.receiverTriggerId,
        ruleId: d.ruleId,
        request: d.originalRequest
      });
      if (
        authority.hubInvocationId !== hubInvocationId ||
        computeHubWebhookWireRequestHash(d.originalRequest) !==
          d.bindings.originalRequestHash ||
        computeHubWebhookWireRequestHash(d.dispatchRequest) !==
          d.bindings.dispatchRequestHash ||
        authority.itemAdapterId !== d.bindings.itemAdapterId ||
        !exactCandidateBindings(authority.candidateBindings, d.bindings.selectedItems)
      ) {
        throw new Error('Scoped webhook mapping bindings are stale or contradictory');
      }
      let envelope = await issuer.issue({
        authorityHandle,
        receiverTriggerId: authority.receiverTrigger.id,
        hubInvocationId,
        requestId,
        operation: 'webhook_handle'
      });
      try {
        let redemption = await redeemer.redeem({
          envelope,
          expected: {
            requestId,
            operation: 'webhook_handle',
            actionId: authority.actionId
          },
          secrets: authority.scopedSecrets
        });
        let stack = await this.core.createRestrictedInvocationStack({
          receiverTrigger: authority.receiverTrigger,
          version: authority.version,
          hubInvocationId,
          redactionSentinels: authority.redactionSentinels,
          forbiddenValues: [
            envelope.grantId,
            envelope.token,
            authorityHandle.id,
            authorityHandle.token
          ],
          redemption
        });
        let result = await slateInvocationService.handleVerifiedWebhookRequest({
          stack,
          invocation: envelope,
          input: {
            actionId: authority.actionId,
            request: d.dispatchRequest,
            specHash: authority.specHash,
            ruleId: authority.rule.id,
            triggerId: authority.receiverTrigger.id,
            originalRequestHash: d.bindings.originalRequestHash,
            dispatchRequestHash: d.bindings.dispatchRequestHash,
            itemAdapterId: authority.itemAdapterId,
            selectedItems:
              authority.candidateBindings.length > 0
                ? authority.candidateBindings.map(candidate => ({
                    ...candidate,
                    deliveryIds: [...candidate.deliveryIds]
                  }))
                : undefined
          }
        });
        if (result.status === 'error') throw new Error(result.error.message);
        if (result.data.response != null) {
          throw new Error('Pure dispatch mapping cannot return a synchronous response');
        }
        return {
          bindings: d.bindings,
          inputs: result.data.inputs,
          ...(result.data.updatedState !== undefined
            ? {
                proposedState: {
                  value: result.data.updatedState,
                  expectedPriorVersion: d.expectedStateVersion,
                  expectedPriorHash: d.expectedStateHash
                }
              }
            : {})
        };
      } finally {
        await issuer.revoke(envelope);
      }
    } finally {
      await resolver.release({
        authorityHandle,
        receiverTriggerId: d.receiverTriggerId,
        hubInvocationId,
        requestId,
        operation: 'webhook_handle'
      });
    }
  }

  private async runProviderWebhookBootstrapProposal(d: {
    receiverTriggerId: string;
    proof: import('../lib/invocation/types').AcceptedWebhookVerificationProof;
    request: HubWebhookWireRequest;
    requestId?: string;
    expectedBindings?: ExactWebhookRuleBinding;
  }) {
    let resolver = this.core.security.webhookAuthorityResolver;
    let proofs = this.core.security.acceptedVerificationProofs;
    if (!resolver || !proofs)
      throw new Error('Webhook bootstrap proof resolution is unavailable');
    let proof = proofs.consume({ proof: d.proof, receiverTriggerId: d.receiverTriggerId });
    if (
      d.expectedBindings &&
      !validateExactBootstrapProposalBindings(proof, d.expectedBindings)
    ) {
      throw new Error('Webhook bootstrap proposal bindings are stale or contradictory');
    }
    let hubInvocationId = getId('slateInvocation').id;
    let requestId = d.requestId ?? randomUUID();
    let resolved = await resolver.resolveAcceptedProof({
      proof,
      request: d.request,
      hubInvocationId,
      requestId,
      operation: 'webhook_bootstrap_capture'
    });
    let { authority, authorityHandle } = resolved;
    try {
      validateAuthority({
        authority,
        receiverTriggerId: d.receiverTriggerId,
        ruleId: proof.ruleId,
        request: d.request
      });
      if (
        !validateBootstrapProposalAuthority({
          authority,
          proof,
          requestHash: computeHubWebhookWireRequestHash(d.request),
          hubInvocationId
        })
      ) {
        throw new Error('Webhook bootstrap proof is stale or contradictory');
      }
      let capabilities = await this.core.negotiateWebhookCapabilities({
        receiverTrigger: authority.receiverTrigger,
        version: authority.version
      });
      if (capabilities.bootstrapCapture.status !== 'v1') {
        if (capabilities.bootstrapCapture.status === 'fail_closed') {
          throw new Error(capabilities.bootstrapCapture.code);
        }
        throw new Error('Provider does not advertise bootstrap capture');
      }
      let issuer = this.core.security.scopedGrantIssuer;
      let redeemer = this.core.security.scopedGrantRedeemer;
      if (!issuer || !redeemer) {
        throw new Error('Authenticated bootstrap capture redemption is unavailable');
      }
      let envelope = await issuer.issue({
        authorityHandle,
        receiverTriggerId: authority.receiverTrigger.id,
        hubInvocationId,
        requestId,
        operation: 'webhook_bootstrap_capture',
        acceptedVerificationProofId: proof.proofId
      });
      let input = {
        actionId: authority.actionId,
        specHash: authority.specHash,
        ruleId: authority.rule.id,
        requestId,
        originalRequest: d.request,
        originalRequestHash: proof.originalRequestHash,
        ...(authority.itemAdapterId
          ? {
              itemAdapter: {
                id: authority.itemAdapterId,
                candidates: authority.candidateBindings.map(candidate => ({
                  ...candidate,
                  deliveryIds: [...candidate.deliveryIds]
                }))
              }
            }
          : {}),
        phase: 'bootstrap' as const,
        receiverTriggerId: authority.receiverTrigger.id,
        registrationVersion: authority.registrationVersion,
        acceptedCandidateIds: proof.candidateBindings.map(candidate => candidate.candidateId)
      };
      let output: unknown;
      try {
        let redemption = await redeemer.redeem({
          envelope,
          expected: {
            requestId,
            operation: 'webhook_bootstrap_capture',
            actionId: authority.actionId
          },
          secrets: authority.scopedSecrets
        });
        let stack = await this.core.createRestrictedInvocationStack({
          receiverTrigger: authority.receiverTrigger,
          version: authority.version,
          hubInvocationId,
          redactionSentinels: authority.redactionSentinels,
          forbiddenValues: [
            envelope.grantId,
            envelope.token,
            authorityHandle.id,
            authorityHandle.token
          ],
          redemption
        });
        let result = await slateInvocationService.captureWebhookBootstrap({
          stack,
          invocation: envelope,
          input
        });
        if (result.status === 'error') throw new Error(result.error.message);
        output = result.data as unknown;
      } finally {
        await issuer.revoke(envelope);
      }
      if (
        !isRecord(output) ||
        (output.status !== 'accepted' && output.status !== 'rejected')
      ) {
        throw new Error('Provider returned an invalid bootstrap capture discriminant');
      }
      if (output.status === 'rejected') {
        if (
          Object.keys(output).some(key => key !== 'status' && key !== 'code') ||
          typeof output.code !== 'string' ||
          !SAFE_REJECTION_CODES.has(output.code)
        ) {
          throw new Error('Provider returned a contradictory bootstrap rejection');
        }
        return { status: 'rejected' as const, code: output.code };
      }
      if (
        !isRecord(output.capturedSecrets) ||
        !isWebhookWireResponse(output.response) ||
        Object.keys(output).some(
          key => !['status', 'capturedSecrets', 'response', 'replayClaim'].includes(key)
        )
      ) {
        throw new Error('Provider returned an invalid bootstrap acceptance');
      }
      let allowedCaptureNames = new Set(
        authority.rule.verify.allowedBootstrapCaptureRefs ?? []
      );
      let capturedSecrets = output.capturedSecrets as Record<string, string>;
      let capturedNames = Object.keys(capturedSecrets).sort();
      let allowedNames = [...allowedCaptureNames].sort();
      if (
        capturedNames.length !== allowedNames.length ||
        capturedNames.some((name, index) => name !== allowedNames[index]) ||
        Object.entries(capturedSecrets).some(
          ([name, secret]) => !allowedCaptureNames.has(name) || typeof secret !== 'string'
        )
      ) {
        throw new Error('Provider returned undeclared or stale bootstrap secrets');
      }
      if (output.replayClaim !== undefined && !isWebhookReplayClaim(output.replayClaim)) {
        throw new Error('Provider returned an invalid bootstrap replay claim');
      }
      let acceptedOutput = {
        status: 'accepted' as const,
        capturedSecrets,
        response: output.response,
        ...(output.replayClaim ? { replayClaim: output.replayClaim as any } : {})
      };
      return {
        status: 'accepted' as const,
        authority,
        proof,
        output: acceptedOutput
      };
    } finally {
      await resolver.release({
        authorityHandle,
        receiverTriggerId: d.receiverTriggerId,
        hubInvocationId,
        requestId,
        operation: 'webhook_bootstrap_capture',
        acceptedVerificationProofId: proof.proofId
      });
    }
  }

  async proposeProviderWebhookBootstrap(d: {
    receiverTriggerId: string;
    proof: import('../lib/invocation/types').AcceptedWebhookVerificationProof;
    request: HubWebhookWireRequest;
    bindings: ExactWebhookRuleBinding;
    requestId?: string;
  }) {
    let proposal = await this.runProviderWebhookBootstrapProposal({
      ...d,
      expectedBindings: d.bindings
    });
    if (proposal.status === 'rejected') return proposal;
    let proof = proposal.proof;
    if (!validateExactBootstrapProposalBindings(proof, d.bindings)) {
      throw new Error('Webhook bootstrap proposal bindings are stale or contradictory');
    }
    return {
      status: 'accepted' as const,
      bindings: d.bindings,
      capturedSecrets: proposal.output.capturedSecrets,
      response: proposal.output.response,
      ...(proposal.output.replayClaim ? { replayClaim: proposal.output.replayClaim } : {})
    };
  }

  async captureProviderWebhookBootstrap(d: {
    receiverTriggerId: string;
    proof: import('../lib/invocation/types').AcceptedWebhookVerificationProof;
    request: HubWebhookWireRequest;
    requestId?: string;
  }) {
    let proposal = await this.runProviderWebhookBootstrapProposal(d);
    if (proposal.status === 'rejected') return proposal;
    if (
      (proposal.authority.rule.verify.allowedBootstrapCaptureRefs?.length ?? 0) === 0 &&
      Object.keys(proposal.output.capturedSecrets).length === 0
    ) {
      return {
        status: 'accepted' as const,
        response: proposal.output.response,
        ...(proposal.output.replayClaim ? { replayClaim: proposal.output.replayClaim } : {}),
        registrationVersion: proposal.authority.registrationVersion
      };
    }
    let writer = this.core.security.bootstrapCaptureWriter;
    if (!writer) throw new Error('Authenticated bootstrap capture persistence is unavailable');
    let commit = await writer.compareAndSet({
      authority: proposal.authority,
      proof: proposal.proof,
      output: proposal.output
    });
    if (commit.status === 'conflict') {
      throw new Error('Webhook bootstrap capture CAS conflict');
    }
    if (
      commit.committed.registrationVersion !== proposal.authority.registrationVersion ||
      !isWebhookWireResponse(commit.committed.response) ||
      (commit.committed.replayClaim !== undefined &&
        !isWebhookReplayClaim(commit.committed.replayClaim))
    ) {
      throw new Error('Webhook bootstrap committed result is invalid or stale');
    }
    return {
      status: commit.status,
      response: commit.committed.response,
      ...(commit.committed.replayClaim ? { replayClaim: commit.committed.replayClaim } : {}),
      registrationVersion: commit.committed.registrationVersion
    };
  }

  async processTriggerEventInput(d: { eventInputId: string }) {
    let eventInput = await db.slateTriggerEventInput.findFirst({
      where: { id: d.eventInputId },
      include: {
        webhookDispatchOutbox: true,
        receiverTrigger: {
          include: receiverTriggerInclude
        }
      }
    });
    if (!eventInput) throw new ServiceError(notFoundError('slate.trigger.event_input'));

    let validStatuses: SlateTriggerEventInputStatus[] = [
      SlateTriggerEventInputStatus.pending,
      SlateTriggerEventInputStatus.retrying
    ];
    if (!validStatuses.includes(eventInput.status)) return;
    if (eventInput.input == null) {
      await this.updateEventInputStatus({
        eventInput,
        data: {
          status: SlateTriggerEventInputStatus.failed,
          errorCode: 'missing_input',
          errorMessage: 'Event input payload is missing.'
        }
      });
      await this.core.recordCallbackEventLifecycle({
        receiver: eventInput.receiverTrigger.receiver,
        action: eventInput.receiverTrigger.action,
        event: {
          id: eventInput.id,
          status: 'failed',
          type: eventInput.receiverTrigger.action.key,
          input: null,
          errorCode: 'missing_input',
          errorMessage: 'Event input payload is missing.'
        }
      });
      await db.slateTriggerReceiver.update({
        where: { oid: eventInput.receiverTrigger.receiver.oid },
        data: { consecutiveEventFailures: { increment: 1 } }
      });
      slateErrorService
        .recordSlateError({
          type: 'trigger_event_input_failed',
          errorCode: 'missing_input',
          errorMessage: 'Event input payload is missing.',
          tenantOid: eventInput.receiverTrigger.receiver.tenantOid,
          slateOid: eventInput.receiverTrigger.receiver.slateOid,
          slateInstanceOid: eventInput.receiverTrigger.receiver.slateInstanceOid,
          triggerReceiverOid: eventInput.receiverTrigger.receiver.oid,
          triggerEventInputOid: eventInput.oid
        })
        .catch(() => {});
      return;
    }
    if (eventInput.receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active) {
      await this.updateEventInputStatus({
        eventInput,
        data: { status: SlateTriggerEventInputStatus.skipped }
      });
      await this.core.recordCallbackEventLifecycle({
        receiver: eventInput.receiverTrigger.receiver,
        action: eventInput.receiverTrigger.action,
        event: {
          id: eventInput.id,
          status: 'skipped',
          type: eventInput.receiverTrigger.action.key,
          input: eventInput.input as Record<string, any> | null
        }
      });
      return;
    }

    let attemptCount = eventInput.attemptCount + 1;
    await db.slateTriggerEventInput.update({
      where: { oid: eventInput.oid },
      data: {
        status: SlateTriggerEventInputStatus.processing,
        attemptCount,
        errorCode: null,
        errorMessage: null
      }
    });
    await this.core.recordCallbackEventLifecycle({
      receiver: eventInput.receiverTrigger.receiver,
      action: eventInput.receiverTrigger.action,
      event: {
        id: eventInput.id,
        status: 'processing',
        type: eventInput.receiverTrigger.action.key,
        input: eventInput.input as Record<string, any> | null
      }
    });

    try {
      let context = await this.core.getInvocationContext({
        receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations
      });

      let stack = await this.core.createInvocationStack({
        receiver: eventInput.receiverTrigger.receiver,
        receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
        version: context.version,
        config: context.config,
        auth: context.auth
      });

      let mapRes = await slateInvocationService.invokeTriggerMapper({
        stack,
        actionId: context.action.key,
        input: eventInput.input as Record<string, any>
      });

      if (mapRes.status === 'error') {
        await this.core.recordTriggerInvocation({
          receiver: eventInput.receiverTrigger.receiver,
          receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
          type: SlateTriggerInvocationType.map_event,
          invocation: mapRes.invocation
        });

        let status =
          attemptCount >= MAX_TRIGGER_EVENT_INPUT_ATTEMPTS
            ? SlateTriggerEventInputStatus.failed
            : SlateTriggerEventInputStatus.retrying;
        await this.updateEventInputStatus({
          eventInput,
          data: {
            status,
            errorCode: mapRes.error.code,
            errorMessage: mapRes.error.message
          }
        });
        if (
          status === SlateTriggerEventInputStatus.failed &&
          eventInput.webhookDispatchOutbox
        ) {
          await db.$transaction(async tx => {
            await tx.slateTriggerWebhookDispatchOutbox.updateMany({
              where: { oid: eventInput.webhookDispatchOutbox!.oid },
              data: {
                status: 'dead_letter',
                safeTerminalCode: 'event_mapping_failed',
                deadLetterMetadata: { code: 'event_mapping_failed' },
                leaseOwner: null,
                leaseExpiresAt: null
              }
            });
            await tx.slateTriggerWebhookReplayClaim.updateMany({
              where: { eventInputOid: eventInput.oid },
              data: { status: 'failed_terminal' }
            });
          });
        }
        await this.core.recordCallbackEventLifecycle({
          receiver: eventInput.receiverTrigger.receiver,
          action: eventInput.receiverTrigger.action,
          event: {
            id: eventInput.id,
            status: status === SlateTriggerEventInputStatus.failed ? 'failed' : 'retrying',
            type: eventInput.receiverTrigger.action.key,
            input: eventInput.input as Record<string, any> | null,
            errorCode: mapRes.error.code,
            errorMessage: mapRes.error.message,
            providerInvocation: mapRes.invocation
          }
        });
        await db.slateTriggerReceiver.update({
          where: { oid: eventInput.receiverTrigger.receiver.oid },
          data: { consecutiveEventFailures: { increment: 1 } }
        });
        slateErrorService
          .recordSlateError({
            type: 'trigger_event_input_failed',
            errorCode: mapRes.error.code,
            errorMessage: mapRes.error.message,
            tenantOid: eventInput.receiverTrigger.receiver.tenantOid,
            slateOid: eventInput.receiverTrigger.receiver.slateOid,
            slateInstanceOid: eventInput.receiverTrigger.receiver.slateInstanceOid,
            invocationOid: mapRes.invocation.oid,
            triggerReceiverOid: eventInput.receiverTrigger.receiver.oid,
            triggerEventInputOid: eventInput.oid
          })
          .catch(() => {});

        if (status === SlateTriggerEventInputStatus.retrying) {
          await slateTriggerEventProcessQueue.add(
            { eventInputId: eventInput.id },
            { delay: Math.min(30_000, 1000 * 2 ** attemptCount) }
          );
        }

        return;
      }
      await db.slateTriggerReceiver.update({
        where: { oid: eventInput.receiverTrigger.receiver.oid },
        data: { consecutiveEventFailures: 0 }
      });

      let existing = await db.slateTriggerEvent.findFirst({
        where: {
          receiverTriggerOid: eventInput.receiverTrigger.oid,
          sourceId: eventInput.webhookDispatchOutbox?.localSourceId ?? mapRes.data.id
        }
      });

      if (existing) {
        if (eventInput.webhookDispatchOutbox) {
          await db.$transaction(async tx => {
            await tx.slateTriggerWebhookDispatchOutbox.updateMany({
              where: {
                oid: eventInput.webhookDispatchOutbox!.oid,
                status: { in: ['pending', 'retryable', 'leased'] }
              },
              data: {
                status: 'dead_letter',
                leaseOwner: null,
                leaseExpiresAt: null,
                safeTerminalCode: 'source_event_already_exists',
                deadLetterMetadata: { code: 'source_event_already_exists' }
              }
            });
            await tx.slateTriggerWebhookReplayClaim.updateMany({
              where: { eventInputOid: eventInput.oid },
              data: { status: 'failed_terminal' }
            });
          });
        }
        if (existing.deliveryStatus === SlateTriggerEventDeliveryStatus.pending) {
          await slateTriggerEventSendQueue.add({ eventId: existing.id }, { id: existing.id });
        }

        await this.core.recordTriggerInvocation({
          receiver: eventInput.receiverTrigger.receiver,
          receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
          eventOid: existing.oid,
          type: SlateTriggerInvocationType.map_event,
          invocation: mapRes.invocation
        });

        await this.updateEventInputStatus({
          eventInput,
          data: {
            status: SlateTriggerEventInputStatus.skipped,
            eventOid: existing.oid
          }
        });
        await this.core.recordCallbackEventLifecycle({
          receiver: eventInput.receiverTrigger.receiver,
          action: eventInput.receiverTrigger.action,
          event: {
            id: eventInput.id,
            status: 'skipped',
            type: existing.type,
            sourceId: existing.sourceId,
            input: eventInput.input as Record<string, any> | null,
            output: existing.output as Record<string, any>,
            providerInvocation: mapRes.invocation
          }
        });

        return;
      }

      let createdAt = new Date();
      let eventRecord = getId('slateTriggerEvent');
      let receiver = eventInput.receiverTrigger.receiver;
      let targets = this.core.resolveTriggerDestinations({
        receiver,
        receiverTrigger: eventInput.receiverTrigger,
        eventType: mapRes.data.type
      });

      let isFilteredCallbackEvent = !targets.shouldDeliver;

      if (eventInput.webhookDispatchOutbox && isFilteredCallbackEvent) {
        let event = await db.$transaction(async tx => {
          let currentOutbox = await tx.slateTriggerWebhookDispatchOutbox.findUniqueOrThrow({
            where: { oid: eventInput.webhookDispatchOutbox!.oid }
          });
          let event = await tx.slateTriggerEvent.create({
            data: {
              oid: eventRecord.oid,
              id: currentOutbox.localEventId,
              receiverOid: receiver.oid,
              receiverTriggerOid: eventInput.receiverTrigger.oid,
              actionOid: eventInput.receiverTrigger.actionOid,
              slateOid: receiver.slate.oid,
              slateInstanceOid: receiver.slateInstance.oid,
              type: mapRes.data.type,
              sourceId: currentOutbox.localSourceId,
              input: eventInput.input,
              output: mapRes.data.output,
              deliveryStatus: SlateTriggerEventDeliveryStatus.skipped,
              signalEventId: '',
              callbackId: receiver.callbackId,
              callbackInstanceId: receiver.callbackInstanceId,
              invocationOid: mapRes.invocation.oid,
              createdAt
            }
          });
          let released = await tx.slateTriggerWebhookDispatchOutbox.updateMany({
            where: {
              oid: currentOutbox.oid,
              status: { in: ['pending', 'retryable', 'leased'] }
            },
            data: {
              status: 'delivered',
              leaseOwner: null,
              leaseExpiresAt: null,
              readyAt: null,
              deliveredAt: new Date(),
              safeTerminalCode: 'event_type_filtered'
            }
          });
          if (released.count !== 1) throw new Error('Webhook outbox delivery CAS lost');
          await tx.slateTriggerWebhookReplayClaim.updateMany({
            where: { eventInputOid: eventInput.oid },
            data: { status: 'delivered', leaseExpiresAt: null }
          });
          await tx.slateTriggerEventInput.update({
            where: { oid: eventInput.oid },
            data: { status: SlateTriggerEventInputStatus.succeeded, eventOid: event.oid }
          });
          return event;
        });

        await this.core.recordTriggerInvocation({
          receiver,
          receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
          eventOid: event.oid,
          type: SlateTriggerInvocationType.map_event,
          invocation: mapRes.invocation
        });
        await this.core.recordCallbackEventLifecycle({
          receiver,
          action: context.action,
          event: {
            id: eventInput.id,
            status: 'skipped',
            type: mapRes.data.type,
            sourceId: eventInput.webhookDispatchOutbox.localSourceId,
            input: eventInput.input as Record<string, any> | null,
            output: mapRes.data.output,
            providerInvocation: mapRes.invocation
          }
        });
        await this.enqueueEventInputArchive(eventInput.id);
        return;
      }

      if (eventInput.webhookDispatchOutbox) {
        let signalRequest = await this.core.buildIdempotentSignalEventRequest({
          receiver,
          action: context.action,
          idempotencyKey: eventInput.webhookDispatchOutbox.signalIdempotencyKey,
          event: {
            id: eventInput.webhookDispatchOutbox.localEventId,
            type: mapRes.data.type,
            sourceId: eventInput.webhookDispatchOutbox.localSourceId,
            output: mapRes.data.output
          }
        });
        let signalRequestFingerprint = computeHubSignalRequestFingerprint(signalRequest);
        let event = await db.$transaction(async tx => {
          let currentOutbox = await tx.slateTriggerWebhookDispatchOutbox.findUniqueOrThrow({
            where: { oid: eventInput.webhookDispatchOutbox!.oid }
          });
          if (
            currentOutbox.signalRequestFingerprint &&
            currentOutbox.signalRequestFingerprint !== signalRequestFingerprint
          ) {
            throw new Error('Webhook outbox Signal fingerprint conflict');
          }
          let event = await tx.slateTriggerEvent.create({
            data: {
              oid: getId('slateTriggerEvent').oid,
              id: currentOutbox.localEventId,
              receiverOid: receiver.oid,
              receiverTriggerOid: eventInput.receiverTrigger.oid,
              actionOid: eventInput.receiverTrigger.actionOid,
              slateOid: receiver.slate.oid,
              slateInstanceOid: receiver.slateInstance.oid,
              type: mapRes.data.type,
              sourceId: currentOutbox.localSourceId,
              input: eventInput.input,
              output: mapRes.data.output,
              deliveryStatus: targets.shouldDeliver
                ? SlateTriggerEventDeliveryStatus.pending
                : SlateTriggerEventDeliveryStatus.skipped,
              signalEventId: '',
              callbackId: receiver.callbackId,
              callbackInstanceId: receiver.callbackInstanceId,
              invocationOid: mapRes.invocation.oid,
              createdAt
            }
          });
          let released = await tx.slateTriggerWebhookDispatchOutbox.updateMany({
            where: {
              oid: currentOutbox.oid,
              signalRequestFingerprint: currentOutbox.signalRequestFingerprint
            },
            data: {
              signalTenantId: signalRequest.tenantId,
              signalRequest: signalRequest as any,
              signalRequestFingerprint,
              readyAt: new Date(),
              nextAttemptAt: new Date()
            }
          });
          if (released.count !== 1) throw new Error('Webhook outbox delivery CAS lost');
          await tx.slateTriggerEventInput.update({
            where: { oid: eventInput.oid },
            data: { status: SlateTriggerEventInputStatus.succeeded, eventOid: event.oid }
          });
          return event;
        });

        await this.core.recordTriggerInvocation({
          receiver,
          receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
          eventOid: event.oid,
          type: SlateTriggerInvocationType.map_event,
          invocation: mapRes.invocation
        });
        await slateTriggerWebhookDispatchOutboxQueue.add(
          { outboxId: eventInput.webhookDispatchOutbox.id },
          { id: eventInput.webhookDispatchOutbox.id }
        );
        await this.enqueueEventInputArchive(eventInput.id);
        return;
      }

      let signalEventId = '';
      if (!isFilteredCallbackEvent) {
        signalEventId = await this.core.createSignalEvent({
          receiver,
          action: context.action,
          event: {
            id: eventInput.id,
            type: mapRes.data.type,
            sourceId: mapRes.data.id,
            input: eventInput.input as Record<string, any> | null,
            output: mapRes.data.output,
            createdAt,
            providerInvocation: mapRes.invocation
          }
        });
      } else {
        await this.core.recordCallbackEventLifecycle({
          receiver,
          action: context.action,
          event: {
            id: eventInput.id,
            status: 'skipped',
            type: mapRes.data.type,
            sourceId: mapRes.data.id,
            input: eventInput.input as Record<string, any> | null,
            output: mapRes.data.output,
            providerInvocation: mapRes.invocation
          }
        });
      }

      let event = await db.slateTriggerEvent.create({
        data: {
          ...eventRecord,
          receiverOid: receiver.oid,
          receiverTriggerOid: eventInput.receiverTrigger.oid,
          actionOid: eventInput.receiverTrigger.actionOid,
          slateOid: receiver.slate.oid,
          slateInstanceOid: receiver.slateInstance.oid,
          type: mapRes.data.type,
          sourceId: mapRes.data.id,
          input: eventInput.input,
          output: mapRes.data.output,
          deliveryStatus: targets.shouldDeliver
            ? SlateTriggerEventDeliveryStatus.pending
            : SlateTriggerEventDeliveryStatus.skipped,
          signalEventId,
          callbackId: receiver.callbackId,
          callbackInstanceId: receiver.callbackInstanceId,
          invocationOid: mapRes.invocation.oid,
          createdAt
        }
      });

      await this.core.recordTriggerInvocation({
        receiver: eventInput.receiverTrigger.receiver,
        receiverTrigger: eventInput.receiverTrigger as ReceiverTriggerWithRelations,
        eventOid: event.oid,
        type: SlateTriggerInvocationType.map_event,
        invocation: mapRes.invocation
      });

      await this.updateEventInputStatus({
        eventInput,
        data: {
          status: SlateTriggerEventInputStatus.succeeded,
          eventOid: event.oid
        }
      });

      if (targets.shouldDeliver) {
        await slateTriggerEventSendQueue.add({ eventId: event.id }, { id: event.id });
      }
    } catch (error) {
      Sentry.captureException(error, {
        extra: { eventInputId: eventInput.id }
      });

      let status =
        attemptCount >= MAX_TRIGGER_EVENT_INPUT_ATTEMPTS
          ? SlateTriggerEventInputStatus.failed
          : SlateTriggerEventInputStatus.retrying;
      let errorMessage =
        error instanceof Error ? error.message : 'Unexpected error while processing trigger';
      let errorCode = 'unexpected_error';
      if (typeof error === 'object' && error && 'code' in error) {
        let possibleCode = (error as { code?: string }).code;
        if (typeof possibleCode === 'string') {
          errorCode = possibleCode;
        }
      }

      await this.updateEventInputStatus({
        eventInput,
        data: {
          status,
          errorCode,
          errorMessage
        }
      });
      if (status === SlateTriggerEventInputStatus.failed && eventInput.webhookDispatchOutbox) {
        await db.$transaction(async tx => {
          await tx.slateTriggerWebhookDispatchOutbox.updateMany({
            where: {
              oid: eventInput.webhookDispatchOutbox!.oid,
              status: { in: ['pending', 'retryable', 'leased'] }
            },
            data: {
              status: 'dead_letter',
              leaseOwner: null,
              leaseExpiresAt: null,
              safeTerminalCode: 'event_mapping_unexpected_error',
              deadLetterMetadata: { code: 'event_mapping_unexpected_error' }
            }
          });
          await tx.slateTriggerWebhookReplayClaim.updateMany({
            where: { eventInputOid: eventInput.oid },
            data: { status: 'failed_terminal' }
          });
        });
      }
      await this.core.recordCallbackEventLifecycle({
        receiver: eventInput.receiverTrigger.receiver,
        action: eventInput.receiverTrigger.action,
        event: {
          id: eventInput.id,
          status: status === SlateTriggerEventInputStatus.failed ? 'failed' : 'retrying',
          type: eventInput.receiverTrigger.action.key,
          input: eventInput.input as Record<string, any> | null,
          errorCode,
          errorMessage
        }
      });
      await db.slateTriggerReceiver.update({
        where: { oid: eventInput.receiverTrigger.receiver.oid },
        data: { consecutiveEventFailures: { increment: 1 } }
      });
      slateErrorService
        .recordSlateError({
          type: 'trigger_event_input_failed',
          errorCode,
          errorMessage,
          tenantOid: eventInput.receiverTrigger.receiver.tenantOid,
          slateOid: eventInput.receiverTrigger.receiver.slateOid,
          slateInstanceOid: eventInput.receiverTrigger.receiver.slateInstanceOid,
          triggerReceiverOid: eventInput.receiverTrigger.receiver.oid,
          triggerEventInputOid: eventInput.oid
        })
        .catch(() => {});

      if (status === SlateTriggerEventInputStatus.retrying) {
        await slateTriggerEventProcessQueue.add(
          { eventInputId: eventInput.id },
          { delay: Math.min(30_000, 1000 * 2 ** attemptCount) }
        );
      }
    }
  }

  private async updateEventInputStatus(d: {
    eventInput: { oid: bigint; id: string };
    data: {
      status: SlateTriggerEventInputStatus;
      errorCode?: string | null;
      errorMessage?: string | null;
      eventOid?: bigint | null;
    };
  }) {
    await db.slateTriggerEventInput.update({
      where: { oid: d.eventInput.oid },
      data: d.data
    });

    if (ARCHIVE_INPUT_STATUSES.has(d.data.status)) {
      await this.enqueueEventInputArchive(d.eventInput.id);
    }
  }

  private async enqueueEventInputArchive(eventInputId: string) {
    try {
      await slateTriggerEventInputArchiveQueue.add({ eventInputId }, { id: eventInputId });
    } catch (error) {
      console.error('Failed to enqueue trigger event input archive:', {
        eventInputId,
        error
      });
    }
  }

  private async createTerminalWebhookEventInput(d: {
    receiverTrigger: ReceiverTriggerWithRelations;
    status: SlateTriggerEventInputStatus;
    input: Record<string, any> | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }) {
    let eventInput = await db.slateTriggerEventInput.create({
      data: {
        ...getId('slateTriggerEventInput'),
        receiverOid: d.receiverTrigger.receiver.oid,
        receiverTriggerOid: d.receiverTrigger.oid,
        actionOid: d.receiverTrigger.actionOid,
        slateOid: d.receiverTrigger.receiver.slate.oid,
        slateInstanceOid: d.receiverTrigger.receiver.slateInstance.oid,
        status: d.status,
        input: d.input,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage
      }
    });

    await this.enqueueEventInputArchive(eventInput.id);
    return eventInput;
  }

  async sendTriggerEvent(d: { eventId: string }) {
    let event = await db.slateTriggerEvent.findFirst({
      where: { id: d.eventId },
      include: {
        action: true,
        receiverTrigger: {
          include: receiverTriggerInclude
        }
      }
    });
    if (!event) throw new ServiceError(notFoundError('slate.trigger.event'));

    if (event.deliveryStatus !== SlateTriggerEventDeliveryStatus.pending) return;
    if (event.receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active) {
      await db.slateTriggerEvent.update({
        where: { oid: event.oid },
        data: { deliveryStatus: SlateTriggerEventDeliveryStatus.skipped }
      });
      return;
    }

    await this.core.dispatchTriggerEvent({
      receiverTrigger: event.receiverTrigger as ReceiverTriggerWithRelations,
      action: event.action,
      event: {
        oid: event.oid,
        id: event.id,
        type: event.type,
        sourceId: event.sourceId,
        input: event.input as Record<string, any> | null,
        output: event.output as Record<string, any>,
        createdAt: event.createdAt,
        signalEventId: event.signalEventId
      }
    });
  }

  private async compensateStaleTelegramWebhookMutation(d: {
    receiverTrigger: ReceiverTriggerWithRelations;
    staleLease: TelegramWebhookMutationLease;
    stack: Awaited<ReturnType<SlateTriggerReceiverCore['createInvocationStack']>>;
  }) {
    await releaseTelegramWebhookMutationLease(d.staleLease);
    await withTelegramWebhookMutationLease(
      d.receiverTrigger.receiver.id,
      async restoreLease => {
        let latest = await this.core.getReceiverTriggerWithRelations(d.receiverTrigger.id);
        if (!restoreLease.remoteKnown) {
          let cleanup = await slateInvocationService.unregisterWebhook({
            stack: d.stack,
            actionId: latest.action.key,
            webhookBaseUrl: await this.getSecuredWebhookBaseUrl(latest, 'receiver'),
            registrationDetails: null,
            state: latest.state
          });
          await this.core.recordTriggerInvocation({
            receiver: latest.receiver,
            receiverTrigger: latest,
            type: SlateTriggerInvocationType.webhook_unregister,
            invocation: cleanup.invocation
          });
          if (cleanup.status === 'error') throw new Error('cleanup_failed');
          return;
        }
        let leader = latest.receiver.triggers.find(
          trigger =>
            !trigger.tombstonedAt &&
            trigger.remoteRegistrationKnown &&
            ['registered', 'renewing'].includes(trigger.registrationStatus)
        );
        if (!leader) throw new Error('cleanup_failed');
        let latestDetails = await slateTriggerReceiverSecretService.resolveRegistrationDetails(
          {
            receiverTriggerId: leader.id
          }
        );
        if (!isRecord(latestDetails)) throw new Error('cleanup_failed');
        if (
          restoreLease.webhookUrl !== getReceiverWebhookBaseUrl(latest.receiver.id) ||
          typeof latestDetails.secretToken !== 'string' ||
          telegramWebhookSecretFingerprint(latestDetails.secretToken) !==
            restoreLease.secretFingerprint
        ) {
          throw new Error('cleanup_failed');
        }
        let registrationAuthority =
          await this.core.security.webhookAuthorityResolver?.resolveRegistration({
            receiverTriggerId: leader.id
          });
        if (!registrationAuthority) throw new Error('cleanup_failed');
        let restore = await slateInvocationService.registerWebhook({
          stack: d.stack,
          actionId: leader.action.key,
          webhookBaseUrl: await this.getSecuredWebhookBaseUrl(latest, 'receiver'),
          registrationDetails: {
            ...latestDetails,
            allowedUpdates: telegramAllowedUpdates(latest),
            singletonGeneration: restoreLease.generation,
            rotateSecret: false
          }
        });
        await this.core.recordTriggerInvocation({
          receiver: latest.receiver,
          receiverTrigger: latest,
          type: SlateTriggerInvocationType.webhook_register,
          invocation: restore.invocation
        });
        if (restore.status === 'error') throw new Error('cleanup_failed');
      }
    );
  }

  private registrationCompensationDetails(
    receiverTrigger: ReceiverTriggerWithRelations,
    registrationDetails: unknown
  ) {
    if (!isRecord(registrationDetails)) return registrationDetails;
    let integrationId =
      receiverTrigger.receiver.slate.slateIdentifierOnRegistry ??
      receiverTrigger.receiver.slate.slateIdOnRegistry;
    if (integrationId === 'google-calendar') {
      return {
        channelId: registrationDetails.channelId,
        resourceId: registrationDetails.resourceId
      };
    }
    if (integrationId === 'word-online') {
      return { subscriptionId: registrationDetails.subscriptionId };
    }
    return registrationDetails;
  }

  private async compensateRemoteRegistration(d: {
    originalError: unknown;
    receiverTrigger: ReceiverTriggerWithRelations;
    stack: Awaited<ReturnType<SlateTriggerReceiverCore['createInvocationStack']>>;
    actionId: string;
    webhookBaseUrl: string;
    registrationDetails: unknown;
    state: unknown;
    telegramLease?: TelegramWebhookMutationLease;
  }): Promise<never> {
    let cleanupError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (isTelegramReceiver(d.receiverTrigger) && d.telegramLease) {
          await this.compensateStaleTelegramWebhookMutation({
            receiverTrigger: d.receiverTrigger,
            staleLease: d.telegramLease,
            stack: d.stack
          });
        } else {
          let cleanup = await slateInvocationService.unregisterWebhook({
            stack: d.stack,
            actionId: d.actionId,
            webhookBaseUrl: d.webhookBaseUrl,
            registrationDetails: this.registrationCompensationDetails(
              d.receiverTrigger,
              d.registrationDetails
            ),
            state: d.state
          });
          await this.core.recordTriggerInvocation({
            receiver: d.receiverTrigger.receiver,
            receiverTrigger: d.receiverTrigger,
            type: SlateTriggerInvocationType.webhook_unregister,
            invocation: cleanup.invocation
          });
          if (cleanup.status === 'error') throw new Error('cleanup_failed');
        }
        throw d.originalError;
      } catch (error) {
        if (error === d.originalError) throw error;
        cleanupError = error;
        Sentry.captureException(error, {
          extra: {
            receiverTriggerId: d.receiverTrigger.id,
            operation: 'webhook_registration_compensation',
            attempt
          }
        });
        console.error('Failed to compensate remote webhook registration:', {
          receiverTriggerId: d.receiverTrigger.id,
          errorCode: 'webhook_registration_cleanup_failed',
          attempt
        });
      }
    }
    throw new Error('cleanup_failed', {
      cause: d.originalError instanceof Error ? d.originalError : cleanupError
    });
  }

  private async reserveTelegramWebhookDetach(d: {
    receiverTrigger: ReceiverTriggerWithRelations;
    lease: TelegramWebhookMutationLease;
    claim: RegistrationAttemptClaim;
  }): Promise<TelegramDetachReservation> {
    let mutationId = `telegram-detach:${d.receiverTrigger.id}:${d.claim.registrationGeneration}`;
    return await db.$transaction(async tx => {
      let receiver = await tx.slateTriggerReceiver.findFirst({
        where: {
          oid: d.lease.receiverOid,
          telegramWebhookLeaseToken: d.lease.token,
          telegramWebhookMutationVersion: d.lease.mutationVersion,
          telegramWebhookGeneration: d.lease.generation
        },
        select: {
          telegramWebhookRefCount: true,
          telegramWebhookRemoteKnown: true,
          telegramWebhookAllowedUpdates: true
        }
      });
      if (!receiver) throw new Error('telegram_webhook_stale_mutation');
      let trigger = await tx.slateTriggerReceiverTrigger.findFirst({
        where: {
          oid: d.receiverTrigger.oid,
          receiverOid: d.lease.receiverOid,
          registrationGeneration: d.claim.registrationGeneration
        }
      });
      if (!trigger) throw new Error('telegram_webhook_stale_mutation');
      if (
        trigger.telegramDetachMutationId === mutationId &&
        trigger.telegramDetachGeneration === d.claim.registrationGeneration
      ) {
        let remaining = await tx.slateTriggerReceiverTrigger.findMany({
          where: {
            receiverOid: d.lease.receiverOid,
            id: { not: trigger.id },
            source: 'webhook',
            tombstonedAt: null,
            remoteRegistrationKnown: true,
            telegramDetachMutationId: null
          },
          include: { action: true },
          orderBy: { id: 'asc' },
          take: 1
        });
        return {
          mutationId,
          generation: d.claim.registrationGeneration,
          final: trigger.telegramDetachFinal === true,
          refCount: receiver.telegramWebhookRefCount,
          allowedUpdates: [...receiver.telegramWebhookAllowedUpdates],
          remoteApplied: trigger.telegramDetachRemoteAppliedAt !== null,
          completed: trigger.telegramDetachCompletedAt !== null,
          leader: remaining[0]
            ? { id: remaining[0].id, actionId: remaining[0].action.key }
            : null
        };
      }
      let otherPending = await tx.slateTriggerReceiverTrigger.findFirst({
        where: {
          receiverOid: d.lease.receiverOid,
          id: { not: trigger.id },
          telegramDetachMutationId: { not: null },
          telegramDetachCompletedAt: null
        },
        select: { id: true }
      });
      if (otherPending) throw new Error('telegram_webhook_detach_pending');
      if (!trigger.remoteRegistrationKnown) {
        return {
          mutationId,
          generation: d.claim.registrationGeneration,
          final: false,
          refCount: receiver.telegramWebhookRefCount,
          allowedUpdates: [...receiver.telegramWebhookAllowedUpdates],
          remoteApplied: true,
          completed: true,
          leader: null
        };
      }
      if (!receiver.telegramWebhookRemoteKnown || receiver.telegramWebhookRefCount < 1) {
        throw new Error('telegram_webhook_refcount_invariant');
      }
      let refCount = receiver.telegramWebhookRefCount - 1;
      let final = refCount === 0;
      let remaining = await tx.slateTriggerReceiverTrigger.findMany({
        where: {
          receiverOid: d.lease.receiverOid,
          id: { not: trigger.id },
          source: 'webhook',
          tombstonedAt: null,
          remoteRegistrationKnown: true,
          telegramDetachMutationId: null
        },
        include: { action: true },
        orderBy: { id: 'asc' }
      });
      if (!final && remaining.length === 0) {
        throw new Error('telegram_webhook_refcount_invariant');
      }
      let allowedUpdates = [
        ...new Set(
          remaining.flatMap(item => TELEGRAM_ALLOWED_UPDATES_BY_ACTION[item.action.key] ?? [])
        )
      ].sort();
      let reservedTrigger = await tx.slateTriggerReceiverTrigger.updateMany({
        where: {
          oid: trigger.oid,
          registrationGeneration: d.claim.registrationGeneration,
          remoteRegistrationKnown: true,
          OR: [
            { telegramDetachMutationId: null },
            { telegramDetachGeneration: { not: d.claim.registrationGeneration } }
          ]
        },
        data: {
          telegramDetachMutationId: mutationId,
          telegramDetachGeneration: d.claim.registrationGeneration,
          telegramDetachFinal: final,
          telegramDetachRemoteAppliedAt: null,
          telegramDetachCompletedAt: null
        }
      });
      if (reservedTrigger.count !== 1) throw new Error('telegram_webhook_stale_mutation');
      let decremented = await tx.slateTriggerReceiver.updateMany({
        where: {
          oid: d.lease.receiverOid,
          telegramWebhookLeaseToken: d.lease.token,
          telegramWebhookMutationVersion: d.lease.mutationVersion,
          telegramWebhookRefCount: receiver.telegramWebhookRefCount,
          telegramWebhookRemoteKnown: true
        },
        data: {
          telegramWebhookRefCount: refCount,
          telegramWebhookAllowedUpdates: allowedUpdates
        }
      });
      if (decremented.count !== 1) throw new Error('telegram_webhook_stale_mutation');
      return {
        mutationId,
        generation: d.claim.registrationGeneration,
        final,
        refCount,
        allowedUpdates,
        remoteApplied: false,
        completed: false,
        leader: remaining[0]
          ? { id: remaining[0].id, actionId: remaining[0].action.key }
          : null
      };
    });
  }

  private async markTelegramWebhookDetachRemoteApplied(d: {
    receiverTriggerOid: bigint;
    lease: TelegramWebhookMutationLease;
    reservation: TelegramDetachReservation;
    now?: Date;
  }) {
    let marked = await db.slateTriggerReceiverTrigger.updateMany({
      where: {
        oid: d.receiverTriggerOid,
        telegramDetachMutationId: d.reservation.mutationId,
        telegramDetachGeneration: d.reservation.generation,
        telegramDetachRemoteAppliedAt: null,
        receiver: {
          telegramWebhookLeaseToken: d.lease.token,
          telegramWebhookMutationVersion: d.lease.mutationVersion
        }
      },
      data: { telegramDetachRemoteAppliedAt: d.now ?? new Date() }
    });
    if (marked.count !== 1) throw new Error('telegram_webhook_stale_mutation');
  }

  private async completeTelegramWebhookDetach(d: {
    receiverTriggerOid: bigint;
    lease: TelegramWebhookMutationLease;
    reservation: TelegramDetachReservation;
    now?: Date;
  }) {
    let now = d.now ?? new Date();
    await db.$transaction(async tx => {
      let completed = await tx.slateTriggerReceiverTrigger.updateMany({
        where: {
          oid: d.receiverTriggerOid,
          telegramDetachMutationId: d.reservation.mutationId,
          telegramDetachGeneration: d.reservation.generation,
          telegramDetachRemoteAppliedAt: { not: null },
          telegramDetachCompletedAt: null
        },
        data: {
          remoteRegistrationKnown: false,
          telegramDetachCompletedAt: now
        }
      });
      if (completed.count !== 1) {
        let prior = await tx.slateTriggerReceiverTrigger.findFirst({
          where: {
            oid: d.receiverTriggerOid,
            telegramDetachMutationId: d.reservation.mutationId,
            telegramDetachGeneration: d.reservation.generation,
            telegramDetachCompletedAt: { not: null }
          },
          select: { oid: true }
        });
        if (!prior) throw new Error('telegram_webhook_stale_mutation');
      }
      let receiver = await tx.slateTriggerReceiver.updateMany({
        where: {
          oid: d.lease.receiverOid,
          telegramWebhookLeaseToken: d.lease.token,
          telegramWebhookMutationVersion: d.lease.mutationVersion,
          telegramWebhookRefCount: d.reservation.refCount
        },
        data: {
          ...(d.reservation.final
            ? {
                telegramWebhookRemoteKnown: false,
                telegramWebhookAllowedUpdates: [],
                telegramWebhookUrl: null,
                telegramWebhookSecretFingerprint: null
              }
            : { telegramWebhookRemoteKnown: true }),
          telegramWebhookLeaseToken: null,
          telegramWebhookLeaseExpiresAt: null
        }
      });
      if (receiver.count !== 1) throw new Error('telegram_webhook_stale_mutation');
    });
  }

  async cleanupRetiringWebhookRegistration(d: {
    receiverTriggerId: string;
    registrationGeneration: number;
    registrationVersion: number;
    now?: Date;
  }): Promise<'cleaned' | 'not_due' | 'stale'> {
    let now = d.now ?? new Date();
    let receiverTrigger = await this.core.getReceiverTriggerWithRelations(d.receiverTriggerId);
    if (
      receiverTrigger.registrationGeneration !== d.registrationGeneration ||
      receiverTrigger.registrationVersion !== d.registrationVersion ||
      !['registered', 'renewing'].includes(receiverTrigger.registrationStatus) ||
      !receiverTrigger.remoteRegistrationKnown ||
      receiverTrigger.tombstonedAt
    ) {
      return 'stale';
    }
    let integrationId =
      receiverTrigger.receiver.slate.slateIdentifierOnRegistry ??
      receiverTrigger.receiver.slate.slateIdOnRegistry;
    if (!['google-calendar', 'word-online'].includes(integrationId)) return 'not_due';
    let details = await slateTriggerReceiverSecretService.resolveRegistrationDetails({
      receiverTriggerId: receiverTrigger.id
    });
    if (!isRecord(details)) return 'not_due';
    let validUntilRaw = details.retiringValidUntil;
    let validUntil =
      typeof validUntilRaw === 'string' && /^\d+$/.test(validUntilRaw)
        ? Number(validUntilRaw)
        : Date.parse(String(validUntilRaw));
    if (!Number.isFinite(validUntil) || validUntil > now.getTime()) return 'not_due';

    let cleanupDetails: Record<string, unknown>;
    let remoteCleanupRequired: boolean;
    let nextDetails = { ...details };
    if (integrationId === 'google-calendar') {
      let retiringChannelId = details.retiringChannelId;
      let retiringResourceId = details.retiringResourceId;
      if (typeof retiringChannelId !== 'string' || typeof retiringResourceId !== 'string') {
        return 'not_due';
      }
      cleanupDetails = { channelId: retiringChannelId, resourceId: retiringResourceId };
      remoteCleanupRequired =
        retiringChannelId !== details.channelId || retiringResourceId !== details.resourceId;
      delete nextDetails.retiringChannelId;
      delete nextDetails.retiringResourceId;
      delete nextDetails.retiringChannelToken;
      delete nextDetails.retiringValidUntil;
    } else {
      let retiringSubscriptionId = details.retiringSubscriptionId;
      if (typeof retiringSubscriptionId !== 'string') return 'not_due';
      cleanupDetails = { subscriptionId: retiringSubscriptionId };
      remoteCleanupRequired = retiringSubscriptionId !== details.subscriptionId;
      delete nextDetails.retiringSubscriptionId;
      delete nextDetails.retiringClientState;
      delete nextDetails.retiringValidUntil;
      if (Array.isArray(nextDetails.subscriptions)) {
        nextDetails.subscriptions = nextDetails.subscriptions.filter(
          candidate =>
            !isRecord(candidate) || candidate.subscriptionId !== retiringSubscriptionId
        );
      }
    }

    if (remoteCleanupRequired) {
      let context = await this.core.getInvocationContext({ receiverTrigger });
      let stack = await this.core.createInvocationStack({
        receiver: receiverTrigger.receiver,
        receiverTrigger,
        version: context.version,
        config: context.config,
        auth: context.auth
      });
      let cleanup = await slateInvocationService.unregisterWebhook({
        stack,
        actionId: context.action.key,
        webhookBaseUrl: await this.getSecuredWebhookBaseUrl(receiverTrigger),
        registrationDetails: cleanupDetails,
        state: receiverTrigger.state
      });
      await this.core.recordTriggerInvocation({
        receiver: receiverTrigger.receiver,
        receiverTrigger,
        type: SlateTriggerInvocationType.webhook_unregister,
        invocation: cleanup.invocation
      });
      if (cleanup.status === 'error') throw new Error('cleanup_failed');
    }
    let committed = await slateTriggerReceiverSecretService.cleanupRetiringRegistrationDetails(
      {
        receiverTriggerId: receiverTrigger.id,
        registrationGeneration: d.registrationGeneration,
        registrationVersion: d.registrationVersion,
        registrationDetails: nextDetails,
        now
      }
    );
    return committed === 'committed' ? 'cleaned' : 'stale';
  }

  async registerWebhookForReceiverTrigger(d: {
    receiverTrigger: ReceiverTriggerWithRelations | SlateTriggerReceiverTrigger;
    claim: RegistrationAttemptClaim;
    assertLeaseOwned?: () => void;
    telegramLease?: TelegramWebhookMutationLease;
  }): Promise<void> {
    let assertLeaseOwned = d.assertLeaseOwned ?? (() => {});
    assertLeaseOwned();
    let receiverTrigger =
      'receiver' in d.receiverTrigger
        ? (d.receiverTrigger as ReceiverTriggerWithRelations)
        : await this.core.getReceiverTriggerWithRelations(d.receiverTrigger.id);
    assertLeaseOwned();

    let spec = getTriggerSpec(receiverTrigger.action);

    if (isTelegramReceiver(receiverTrigger) && !d.telegramLease) {
      return await withTelegramWebhookMutationLease(receiverTrigger.receiver.id, async lease =>
        this.registerWebhookForReceiverTrigger({
          ...d,
          receiverTrigger: { id: receiverTrigger.id } as SlateTriggerReceiverTrigger,
          telegramLease: lease
        })
      );
    }

    if (spec.invocation.type !== SlateTriggerReceiverTriggerSource.webhook) {
      await slateTriggerRegistrationLifecycleService.succeed({
        ...d.claim,
        remoteRegistrationKnown: false
      });
      return;
    }

    if (!spec.invocation.autoRegistration) {
      let http = spec.invocation.http as unknown;
      if (
        isRecord(http) &&
        isRecord(http.registration) &&
        http.registration.mode === 'manual_bootstrap'
      ) {
        if (!(await slateTriggerRegistrationLifecycleService.awaitManualBootstrap(d.claim))) {
          return;
        }
        return;
      }

      let commit = await slateTriggerReceiverSecretService.commitRegistrationResult({
        claim: d.claim,
        registrationDetails: null,
        remoteRegistrationKnown: false
      });
      if (commit === 'stale') return;
      return;
    }

    let context = await this.core.getInvocationContext({ receiverTrigger });
    assertLeaseOwned();
    let capabilities = await this.core.negotiateWebhookCapabilities({
      receiverTrigger,
      version: context.version
    });
    assertLeaseOwned();

    let registrationAuthority: AuthoritativeWebhookRegistration | undefined;
    if (capabilities.registration.status === 'fail_closed') {
      throw new Error(capabilities.registration.code);
    }
    if (capabilities.registration.status === 'v1') {
      let resolver = this.core.security.webhookAuthorityResolver;
      if (!resolver) throw new Error('Authoritative webhook registration is unavailable');
      registrationAuthority = await resolver.resolveRegistration({
        receiverTriggerId: receiverTrigger.id
      });
      assertLeaseOwned();
      validateRegistrationAuthority(registrationAuthority);
      if (registrationAuthority.receiverTrigger.id !== receiverTrigger.id) {
        throw new Error('Authoritative webhook registration receiver is stale');
      }
    }

    let stack = await this.core.createInvocationStack({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      version: context.version,
      config: context.config,
      auth: context.auth
    });
    assertLeaseOwned();

    let telegramRegistrationDetails: Record<string, unknown> | undefined;
    let renewalRegistrationDetails =
      d.claim.intent === 'renew'
        ? await slateTriggerReceiverSecretService.resolveRegistrationDetails({
            receiverTriggerId: receiverTrigger.id
          })
        : undefined;
    let webhookBaseUrl = await this.getSecuredWebhookBaseUrl(receiverTrigger);
    if (isTelegramReceiver(receiverTrigger)) {
      webhookBaseUrl = await this.getSecuredWebhookBaseUrl(receiverTrigger, 'receiver');
      let sibling = receiverTrigger.receiver.triggers.find(
        trigger =>
          trigger.id !== receiverTrigger.id &&
          !trigger.tombstonedAt &&
          trigger.remoteRegistrationKnown &&
          ['registered', 'renewing'].includes(trigger.registrationStatus)
      );
      let siblingDetails = sibling
        ? await slateTriggerReceiverSecretService.resolveRegistrationDetails({
            receiverTriggerId: sibling.id
          })
        : null;
      let currentDetails =
        !siblingDetails && receiverTrigger.remoteRegistrationKnown
          ? await slateTriggerReceiverSecretService.resolveRegistrationDetails({
              receiverTriggerId: receiverTrigger.id
            })
          : null;
      let rotatesSingleton =
        Boolean(d.telegramLease) &&
        (!d.telegramLease!.remoteKnown || ['renew', 'reregister'].includes(d.claim.intent));
      let singletonGeneration = rotatesSingleton
        ? (d.telegramLease?.generation ?? 0) + 1
        : (d.telegramLease?.generation ?? 1);
      telegramRegistrationDetails = {
        ...(isRecord(siblingDetails)
          ? siblingDetails
          : isRecord(currentDetails)
            ? currentDetails
            : {}),
        allowedUpdates: telegramAllowedUpdates(receiverTrigger),
        singletonGeneration,
        rotateSecret: singletonGeneration !== d.telegramLease?.generation
      };
      if (
        d.telegramLease?.remoteKnown &&
        (d.telegramLease.webhookUrl !==
          getReceiverWebhookBaseUrl(receiverTrigger.receiver.id) ||
          typeof telegramRegistrationDetails.secretToken !== 'string' ||
          telegramWebhookSecretFingerprint(telegramRegistrationDetails.secretToken) !==
            d.telegramLease.secretFingerprint)
      ) {
        throw new Error('telegram_webhook_authority_mismatch');
      }
    }

    if (
      d.claim.intent === 'reregister' &&
      receiverTrigger.remoteRegistrationKnown &&
      !isTelegramReceiver(receiverTrigger)
    ) {
      let priorRegistrationDetails =
        await slateTriggerReceiverSecretService.resolveRegistrationDetails({
          receiverTriggerId: receiverTrigger.id
        });
      assertLeaseOwned();
      if (!priorRegistrationDetails) throw new Error('cleanup_failed');
      let cleanup = await slateInvocationService.unregisterWebhook({
        stack,
        actionId: context.action.key,
        webhookBaseUrl,
        registrationDetails: priorRegistrationDetails,
        state: receiverTrigger.state
      });
      assertLeaseOwned();
      await this.core.recordTriggerInvocation({
        receiver: receiverTrigger.receiver,
        receiverTrigger,
        type: SlateTriggerInvocationType.webhook_unregister,
        invocation: cleanup.invocation
      });
      assertLeaseOwned();
      if (cleanup.status === 'error') throw new Error('cleanup_failed');
      if (
        !(await slateTriggerRegistrationLifecycleService.markRemoteRegistrationRemoved(
          d.claim
        ))
      ) {
        return;
      }
    }

    if (d.telegramLease && !(await isTelegramWebhookMutationLeaseCurrent(d.telegramLease))) {
      throw new Error('telegram_webhook_stale_mutation');
    }
    let res = await slateInvocationService.registerWebhook({
      stack,
      actionId: context.action.key,
      webhookBaseUrl,
      registrationDetails: telegramRegistrationDetails ?? renewalRegistrationDetails
    });
    if (res.status === 'error') {
      await this.core.recordTriggerInvocation({
        receiver: receiverTrigger.receiver,
        receiverTrigger,
        type: SlateTriggerInvocationType.webhook_register,
        invocation: res.invocation
      });
      console.error('Failed to register trigger webhook:', {
        receiverTriggerId: receiverTrigger.id,
        errorCode: 'webhook_registration_failed'
      });
      throw new Error('provider_rejected');
    }
    try {
      // From this point until the atomic commit succeeds, every failure must
      // compensate the remote create. This includes lease loss, cancellation,
      // audit recording, result validation, and stale/throwing persistence.
      assertLeaseOwned();
      await this.core.recordTriggerInvocation({
        receiver: receiverTrigger.receiver,
        receiverTrigger,
        type: SlateTriggerInvocationType.webhook_register,
        invocation: res.invocation
      });
      assertLeaseOwned();

      let registrationData = res.data as typeof res.data & {
        capturedSecrets?: Record<string, string>;
      };
      if (capabilities.registration.status === 'v1') {
        if (!registrationAuthority) {
          throw new Error('Authoritative webhook registration is unavailable');
        }
        if (
          !isRecord(registrationData.capturedSecrets) ||
          Object.entries(registrationData.capturedSecrets ?? {}).some(
            ([name, secret]) => !name || typeof secret !== 'string' || secret.length === 0
          )
        ) {
          throw new Error(
            'Webhook registration returned invalid, missing, or undeclared secrets'
          );
        }
        let commit = await slateTriggerReceiverSecretService.commitRegistrationResult({
          claim: d.claim,
          authority: registrationAuthority,
          registrationDetails: res.data.registrationDetails,
          remoteRegistrationKnown: true,
          state: res.data.state,
          capturedSecrets: registrationData.capturedSecrets,
          ...(d.telegramLease
            ? {
                telegramAuthority: {
                  ...d.telegramLease,
                  generation:
                    typeof telegramRegistrationDetails?.singletonGeneration === 'number'
                      ? telegramRegistrationDetails.singletonGeneration
                      : d.telegramLease.generation,
                  refCount: receiverTrigger.receiver.triggers.filter(
                    trigger =>
                      !trigger.tombstonedAt &&
                      trigger.source === SlateTriggerReceiverTriggerSource.webhook &&
                      !['unregistered', 'unregistering'].includes(trigger.registrationStatus)
                  ).length,
                  allowedUpdates: telegramAllowedUpdates(receiverTrigger),
                  webhookUrl: getReceiverWebhookBaseUrl(receiverTrigger.receiver.id),
                  secretFingerprint: telegramWebhookSecretFingerprint(
                    registrationData.capturedSecrets!.telegram_secret_token!
                  )
                }
              }
            : {})
        });
        if (commit !== 'committed') {
          throw new Error('registration_capture_conflict');
        }
        return;
      }

      if (registrationData.capturedSecrets !== undefined) {
        throw new Error('Legacy webhook registration cannot return captured secrets');
      }

      assertLeaseOwned();
      let commit = await slateTriggerReceiverSecretService.commitRegistrationResult({
        claim: d.claim,
        registrationDetails: res.data.registrationDetails ?? null,
        remoteRegistrationKnown: true,
        state: res.data.state ?? receiverTrigger.state
      });
      if (commit !== 'committed') throw new Error('registration_capture_conflict');
      return;
    } catch (error) {
      return await this.compensateRemoteRegistration({
        originalError: error,
        receiverTrigger,
        stack,
        actionId: context.action.key,
        webhookBaseUrl,
        registrationDetails: res.data.registrationDetails,
        state: res.data.state ?? receiverTrigger.state,
        telegramLease: d.telegramLease
      });
    }
  }

  async registerWebhookForReceiverTriggerId(d: {
    receiverTriggerId: string;
    registrationGeneration: number;
  }) {
    let claim = await slateTriggerRegistrationLifecycleService.claim({
      ...d,
      operation: 'register'
    });
    if (!claim) return;
    try {
      await this.withRegistrationLease(claim, async assertLeaseOwned => {
        let receiverTrigger = await this.core.getReceiverTriggerWithRelations(
          d.receiverTriggerId
        );
        assertLeaseOwned();
        await this.registerWebhookForReceiverTrigger({
          receiverTrigger,
          claim,
          assertLeaseOwned
        });
      });
    } catch (error) {
      if (error instanceof RegistrationLeaseLostError) throw error;
      let failure = safeRegistrationFailure(
        error,
        error instanceof Error && error.message.includes('cleanup_failed')
          ? 'cleanup_failed'
          : 'provider_transport_error'
      );
      await slateTriggerRegistrationLifecycleService.fail({ ...claim, code: failure.code });
      throw registrationFailureError(failure.code);
    }
  }

  async unregisterWebhookForReceiverTrigger(d: {
    receiverTrigger: ReceiverTriggerWithRelations | SlateTriggerReceiverTrigger;
    claim: RegistrationAttemptClaim;
    assertLeaseOwned?: () => void;
    telegramLease?: TelegramWebhookMutationLease;
  }): Promise<void> {
    let assertLeaseOwned = d.assertLeaseOwned ?? (() => {});
    assertLeaseOwned();
    let receiverTrigger =
      'receiver' in d.receiverTrigger
        ? (d.receiverTrigger as ReceiverTriggerWithRelations)
        : await this.core.getReceiverTriggerWithRelations(d.receiverTrigger.id);
    assertLeaseOwned();

    let spec = getTriggerSpec(receiverTrigger.action);

    if (isTelegramReceiver(receiverTrigger) && !d.telegramLease) {
      return await withTelegramWebhookMutationLease(receiverTrigger.receiver.id, async lease =>
        this.unregisterWebhookForReceiverTrigger({
          ...d,
          receiverTrigger: { id: receiverTrigger.id } as SlateTriggerReceiverTrigger,
          telegramLease: lease
        })
      );
    }

    if (
      spec.invocation.type !== SlateTriggerReceiverTriggerSource.webhook ||
      !spec.invocation.autoUnregistration
    ) {
      if (receiverTrigger.remoteRegistrationKnown) {
        throw new Error('registration_capability_unavailable');
      }
      await slateTriggerRegistrationLifecycleService.succeed({
        ...d.claim,
        remoteRegistrationKnown: false
      });
      return;
    }

    let registrationDetails =
      await slateTriggerReceiverSecretService.resolveRegistrationDetails({
        receiverTriggerId: receiverTrigger.id
      });
    assertLeaseOwned();
    if (!registrationDetails) {
      if (!receiverTrigger.remoteRegistrationKnown) {
        await slateTriggerRegistrationLifecycleService.succeed({
          ...d.claim,
          remoteRegistrationKnown: false
        });
        await slateTriggerReceiverSecretService.revokeRegistrationSecrets({
          receiverTriggerId: receiverTrigger.id
        });
        return;
      }
      throw new Error('invalid_provider_result');
    }

    let context = await this.core.getInvocationContext({ receiverTrigger });
    assertLeaseOwned();

    let stack = await this.core.createInvocationStack({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      version: context.version,
      config: context.config,
      auth: context.auth
    });
    assertLeaseOwned();

    if (isTelegramReceiver(receiverTrigger)) {
      if (!d.telegramLease) throw new Error('telegram_webhook_lease_missing');
      let reservation = await this.reserveTelegramWebhookDetach({
        receiverTrigger,
        lease: d.telegramLease,
        claim: d.claim
      });
      if (!reservation.completed && !reservation.remoteApplied) {
        assertLeaseOwned();
        if (reservation.final) {
          let removed = await slateInvocationService.unregisterWebhook({
            stack,
            actionId: context.action.key,
            webhookBaseUrl: await this.getSecuredWebhookBaseUrl(receiverTrigger, 'receiver'),
            registrationDetails,
            state: receiverTrigger.state
          });
          if (removed.status === 'error') throw new Error('provider_rejected');
          await this.markTelegramWebhookDetachRemoteApplied({
            receiverTriggerOid: receiverTrigger.oid,
            lease: d.telegramLease,
            reservation
          });
          await this.core.recordTriggerInvocation({
            receiver: receiverTrigger.receiver,
            receiverTrigger,
            type: SlateTriggerInvocationType.webhook_unregister,
            invocation: removed.invocation
          });
        } else {
          if (!reservation.leader) throw new Error('telegram_webhook_refcount_invariant');
          let leader = await this.core.getReceiverTriggerWithRelations(reservation.leader.id);
          let leaderDetails =
            await slateTriggerReceiverSecretService.resolveRegistrationDetails({
              receiverTriggerId: leader.id
            });
          if (
            !isRecord(leaderDetails) ||
            typeof leaderDetails.secretToken !== 'string' ||
            telegramWebhookSecretFingerprint(leaderDetails.secretToken) !==
              d.telegramLease.secretFingerprint
          ) {
            throw new Error('telegram_webhook_authority_mismatch');
          }
          let registrationAuthority =
            await this.core.security.webhookAuthorityResolver?.resolveRegistration({
              receiverTriggerId: leader.id
            });
          if (!registrationAuthority) {
            throw new Error('registration_capability_unavailable');
          }
          let updated = await slateInvocationService.registerWebhook({
            stack,
            actionId: reservation.leader.actionId,
            webhookBaseUrl: await this.getSecuredWebhookBaseUrl(receiverTrigger, 'receiver'),
            registrationDetails: {
              ...leaderDetails,
              allowedUpdates: reservation.allowedUpdates,
              singletonGeneration: d.telegramLease.generation,
              rotateSecret: false
            }
          });
          if (updated.status === 'error') throw new Error('provider_rejected');
          let captured = (updated.data as { capturedSecrets?: Record<string, string> })
            .capturedSecrets?.telegram_secret_token;
          if (
            !captured ||
            telegramWebhookSecretFingerprint(captured) !== d.telegramLease.secretFingerprint
          ) {
            throw new Error('invalid_provider_result');
          }
          await this.markTelegramWebhookDetachRemoteApplied({
            receiverTriggerOid: receiverTrigger.oid,
            lease: d.telegramLease,
            reservation
          });
          await this.core.recordTriggerInvocation({
            receiver: receiverTrigger.receiver,
            receiverTrigger,
            type: SlateTriggerInvocationType.webhook_register,
            invocation: updated.invocation
          });
        }
      }
      if (!reservation.completed) {
        await this.completeTelegramWebhookDetach({
          receiverTriggerOid: receiverTrigger.oid,
          lease: d.telegramLease,
          reservation
        });
      }
      if (
        !(await slateTriggerRegistrationLifecycleService.markRemoteRegistrationRemoved(
          d.claim
        ))
      ) {
        return;
      }
      await slateTriggerRegistrationLifecycleService.succeed({
        ...d.claim,
        remoteRegistrationKnown: false
      });
      await slateTriggerReceiverSecretService.revokeRegistrationSecrets({
        receiverTriggerId: receiverTrigger.id
      });
      return;
    }
    let res = await slateInvocationService.unregisterWebhook({
      stack,
      actionId: context.action.key,
      webhookBaseUrl: await this.getSecuredWebhookBaseUrl(receiverTrigger),
      registrationDetails,
      state: receiverTrigger.state
    });
    assertLeaseOwned();

    await this.core.recordTriggerInvocation({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      type: SlateTriggerInvocationType.webhook_unregister,
      invocation: res.invocation
    });
    assertLeaseOwned();

    if (res.status === 'error') {
      console.error('Failed to unregister trigger webhook:', {
        receiverTriggerId: receiverTrigger.id,
        errorCode: 'webhook_unregistration_failed'
      });
      throw new Error('provider_rejected');
    }

    if (
      !(await slateTriggerRegistrationLifecycleService.markRemoteRegistrationRemoved(d.claim))
    ) {
      return;
    }
    assertLeaseOwned();
    await slateTriggerRegistrationLifecycleService.succeed({
      ...d.claim,
      remoteRegistrationKnown: false
    });
    await slateTriggerReceiverSecretService.revokeRegistrationSecrets({
      receiverTriggerId: receiverTrigger.id
    });
    return;
  }

  async unregisterWebhookForReceiverTriggerId(d: {
    receiverTriggerId: string;
    registrationGeneration: number;
  }) {
    let claim = await slateTriggerRegistrationLifecycleService.claim({
      ...d,
      operation: 'unregister'
    });
    if (!claim) return;
    try {
      await this.withRegistrationLease(claim, async assertLeaseOwned => {
        let receiverTrigger = await this.core.getReceiverTriggerWithRelations(
          d.receiverTriggerId
        );
        assertLeaseOwned();
        await this.unregisterWebhookForReceiverTrigger({
          receiverTrigger,
          claim,
          assertLeaseOwned
        });
      });
    } catch (error) {
      if (error instanceof RegistrationLeaseLostError) throw error;
      let failure = safeRegistrationFailure(error);
      await slateTriggerRegistrationLifecycleService.fail({ ...claim, code: failure.code });
      throw registrationFailureError(failure.code);
    }
  }

  async pollTriggerReceiverTrigger(d: { receiverTriggerId: string }) {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: {
        id: d.receiverTriggerId
      },
      include: receiverTriggerInclude
    });
    if (!receiverTrigger)
      throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));

    if (receiverTrigger.source !== SlateTriggerReceiverTriggerSource.polling) return;
    if (receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active) return;

    let context = await this.core.getInvocationContext({ receiverTrigger });

    let stack = await this.core.createInvocationStack({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      version: context.version,
      config: context.config,
      auth: context.auth
    });

    let pollRes = await slateInvocationService.pollTriggerForEvents({
      stack,
      actionId: context.action.key,
      state: receiverTrigger.state
    });

    await this.core.recordTriggerInvocation({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      type: SlateTriggerInvocationType.poll,
      invocation: pollRes.invocation
    });

    let now = new Date();
    let nextPollAt = receiverTrigger.pollIntervalSeconds
      ? new Date(now.getTime() + receiverTrigger.pollIntervalSeconds * 1000)
      : null;

    if (pollRes.status === 'error') {
      console.error('Failed to poll trigger receiver:', {
        receiverTriggerId: receiverTrigger.id,
        error: pollRes.error
      });
      await db.slateTriggerReceiverTrigger.update({
        where: { oid: receiverTrigger.oid },
        data: {
          lastPolledAt: now,
          nextPollAt
        }
      });
      await db.slateTriggerReceiver.update({
        where: { oid: receiverTrigger.receiver.oid },
        data: { consecutivePollingFailures: { increment: 1 } }
      });
      return;
    }

    await db.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        state:
          pollRes.data.updatedState !== undefined
            ? pollRes.data.updatedState
            : receiverTrigger.state,
        lastPolledAt: now,
        nextPollAt
      }
    });
    await db.slateTriggerReceiver.update({
      where: { oid: receiverTrigger.receiver.oid },
      data: { consecutivePollingFailures: 0 }
    });

    await this.core.enqueueTriggerEventInputs({
      receiverTrigger,
      inputs: pollRes.data.inputs
    });
  }

  private async handleWebhookForReceiverTrigger(d: {
    receiverTrigger: ReceiverTriggerWithRelations;
    request: TriggerWebhookRequestPayload;
    invocationGuard?: () => Promise<boolean>;
    enterCommit?: () => Promise<boolean>;
  }): Promise<
    | { status: 'ignored' }
    | { status: 'abandoned' }
    | { status: 'error' }
    | { status: 'handled'; response?: WebhookHttpResponse }
  > {
    let canInvoke = async () => !d.invocationGuard || (await d.invocationGuard());
    let enterCommit = async () => !d.enterCommit || (await d.enterCommit());
    let receiverTrigger = d.receiverTrigger;
    if (!isRoutableWebhookReceiverTrigger(receiverTrigger)) {
      return { status: 'ignored' };
    }
    if (receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active) {
      return { status: 'ignored' };
    }
    if (!webhookTriggerAllowsMethod(receiverTrigger.action, d.request.method)) {
      return { status: 'ignored' };
    }
    if (!(await canInvoke())) return { status: 'abandoned' };

    let context = await this.core.getInvocationContext({ receiverTrigger });
    let registrationDetails =
      await slateTriggerReceiverSecretService.resolveRegistrationDetails({
        receiverTriggerId: receiverTrigger.id
      });

    let payloadBytes = getWebhookInvocationPayloadBytes({
      actionId: context.action.key,
      request: d.request,
      state: receiverTrigger.state,
      registrationDetails
    });
    if (payloadBytes > MAX_WEBHOOK_INVOCATION_PAYLOAD_BYTES) {
      console.error('Webhook payload is too large to process.', {
        receiverId: receiverTrigger.receiver.id,
        receiverTriggerId: receiverTrigger.id,
        payloadBytes,
        maxPayloadBytes: MAX_WEBHOOK_INVOCATION_PAYLOAD_BYTES
      });
      if (!(await enterCommit())) return { status: 'abandoned' };
      await this.core.recordCallbackEventLifecycle({
        receiver: receiverTrigger.receiver,
        action: context.action,
        event: {
          id: getId('slateTriggerEventInput').id,
          status: 'failed',
          type: context.action.key,
          input: getWebhookLifecycleInput(d.request),
          errorCode: 'webhook_payload_too_large',
          errorMessage: 'Webhook payload is too large to process.'
        }
      });
      return { status: 'handled' };
    }

    if (!(await canInvoke())) return { status: 'abandoned' };
    let stack = await this.core.createInvocationStack({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      version: context.version,
      config: context.config,
      auth: context.auth
    });

    if (!(await canInvoke())) return { status: 'abandoned' };
    let res = await slateInvocationService.handleWebhookRequest({
      stack,
      actionId: context.action.key,
      url: d.request.url,
      method: d.request.method,
      headers: d.request.headers,
      body: d.request.body ?? null,
      state: receiverTrigger.state,
      registrationDetails
    });

    // This is the only RPC-to-commit transition. Synchronous callers atomically persist it
    // before any trigger state, lifecycle, event, or invocation-link side effects are applied.
    if (!(await enterCommit())) return { status: 'abandoned' };
    await this.core.recordTriggerInvocation({
      receiver: receiverTrigger.receiver,
      receiverTrigger,
      type: SlateTriggerInvocationType.webhook_handle,
      invocation: res.invocation,
      hasResponse: res.status === 'success' && Boolean(res.data.response)
    });
    if (res.status === 'error') {
      console.error('Failed to handle trigger webhook:', {
        receiverTriggerId: receiverTrigger.id,
        errorCode: 'webhook_provider_error'
      });
      let eventInput = await this.createTerminalWebhookEventInput({
        receiverTrigger,
        status: SlateTriggerEventInputStatus.failed,
        input: getWebhookLifecycleInput(d.request),
        errorCode: 'webhook_provider_error',
        errorMessage: 'Webhook provider invocation failed.'
      });

      await this.core.recordCallbackEventLifecycle({
        receiver: receiverTrigger.receiver,
        action: context.action,
        event: {
          id: eventInput.id,
          status: 'failed',
          type: context.action.key,
          input: eventInput.input as Record<string, any> | null,
          errorCode: 'webhook_provider_error',
          errorMessage: 'Webhook provider invocation failed.',
          providerInvocation: res.invocation
        }
      });
      return { status: 'error' };
    }

    await db.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        state:
          res.data.updatedState !== undefined ? res.data.updatedState : receiverTrigger.state
      }
    });
    if (res.data.inputs.length === 0) {
      let eventInput = await this.createTerminalWebhookEventInput({
        receiverTrigger,
        status: SlateTriggerEventInputStatus.skipped,
        input: getWebhookLifecycleInput(d.request)
      });

      await this.core.recordCallbackEventLifecycle({
        receiver: receiverTrigger.receiver,
        action: context.action,
        event: {
          id: eventInput.id,
          status: 'skipped',
          type: context.action.key,
          input: eventInput.input as Record<string, any> | null,
          providerInvocation: res.invocation
        }
      });
      return {
        status: 'handled',
        response: res.data.response ?? undefined
      };
    }

    await this.core.enqueueTriggerEventInputs({
      receiverTrigger,
      inputs: res.data.inputs
    });

    return {
      status: 'handled',
      response: res.data.response ?? undefined
    };
  }

  async handleTriggerWebhook(d: {
    receiverTriggerId: string;
    request: TriggerWebhookRequestPayload;
    invocationGuard?: () => Promise<boolean>;
    enterCommit?: () => Promise<boolean>;
  }) {
    let receiverTrigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: {
        id: d.receiverTriggerId
      },
      include: receiverTriggerInclude
    });
    if (!receiverTrigger)
      throw new ServiceError(notFoundError('slate.trigger.receiver_trigger'));

    return await this.handleWebhookForReceiverTrigger({
      receiverTrigger: receiverTrigger as ReceiverTriggerWithRelations,
      request: d.request,
      invocationGuard: d.invocationGuard,
      enterCommit: d.enterCommit
    });
  }

  /**
   * Captured requests cross verification only through the atomic commit seam,
   * which owns event/outbox/Signal durability.
   */
  async handleCapturedTriggerWebhook(d: {
    receiverTriggerId: string;
    request: HubWebhookWireRequest;
    requestId?: string;
  }): Promise<ExactWebhookPipelineResult> {
    parseWebhookWireRequest(d.request);
    let receiverTrigger = await this.core.getReceiverTriggerWithRelations(d.receiverTriggerId);
    if (
      !isRoutableWebhookReceiverTrigger(receiverTrigger) ||
      receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active
    ) {
      return { status: 'rejected', code: 'routing_projection_unavailable' };
    }
    let requestId = d.requestId ?? randomUUID();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let result = await this.executeCapturedExactWebhook({
        receiverId: receiverTrigger.receiver.id,
        requestId,
        request: d.request,
        receiverTriggers: [receiverTrigger]
      });
      if (result.status !== 'rejected' || result.code !== 'state_cas_conflict') {
        return result;
      }
      receiverTrigger = await this.core.getReceiverTriggerWithRelations(d.receiverTriggerId);
    }
    return { status: 'rejected', code: 'state_cas_conflict' };
  }

  async handleCapturedSharedAppWebhook(d: {
    boundary: SharedAppAuthenticatedBoundary;
    request: HubWebhookWireRequest;
    requestId: string;
  }): Promise<ExactWebhookPipelineResult> {
    parseWebhookWireRequest(d.request);
    if (!isTrustedSharedAppBoundary(d.boundary)) {
      return { status: 'rejected', code: 'routing_projection_unavailable' };
    }
    let receiverTrigger = await this.core.getReceiverTriggerWithRelations(
      d.boundary.receiverTriggerId
    );
    if (
      !isRoutableWebhookReceiverTrigger(receiverTrigger) ||
      receiverTrigger.receiver.status !== SlateTriggerReceiverStatus.active ||
      receiverTrigger.receiver.id !== d.boundary.receiverId
    ) {
      return { status: 'rejected', code: 'routing_projection_stale' };
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let result = await this.executeCapturedExactWebhook({
        receiverId: receiverTrigger.receiver.id,
        requestId: d.requestId,
        request: d.request,
        receiverTriggers: [receiverTrigger],
        sharedBoundary: d.boundary
      });
      if (result.status !== 'rejected' || result.code !== 'state_cas_conflict') {
        return result;
      }
      receiverTrigger = await this.core.getReceiverTriggerWithRelations(
        d.boundary.receiverTriggerId
      );
    }
    return { status: 'rejected', code: 'state_cas_conflict' };
  }

  async handleCapturedReceiverWebhook(d: {
    receiverId: string;
    request: HubWebhookWireRequest;
    requestId?: string;
    excludeReceiverTriggerIds?: string[];
    onReceiverTriggerCompleted?: (receiverTriggerId: string) => Promise<void>;
  }): Promise<ExactWebhookPipelineResult> {
    parseWebhookWireRequest(d.request);
    let receiver = await db.slateTriggerReceiver.findFirst({
      where: { id: d.receiverId },
      include: receiverInclude
    });
    if (!receiver || receiver.status !== SlateTriggerReceiverStatus.active) {
      return { status: 'rejected', code: 'routing_projection_unavailable' };
    }
    let receiverTriggers = receiver.triggers
      .filter(
        trigger =>
          isRoutableWebhookReceiverTrigger(trigger) &&
          !d.excludeReceiverTriggerIds?.includes(trigger.id)
      )
      .map(trigger => ({ ...trigger, receiver }) as unknown as ReceiverTriggerWithRelations);
    let requestId = d.requestId ?? randomUUID();
    let result: ExactWebhookPipelineResult = {
      status: 'rejected',
      code: 'state_cas_conflict'
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      result = await this.executeCapturedExactWebhook({
        receiverId: receiver.id,
        requestId,
        request: d.request,
        receiverTriggers
      });
      if (result.status !== 'rejected' || result.code !== 'state_cas_conflict') break;
      receiver = (await db.slateTriggerReceiver.findFirst({
        where: { id: d.receiverId },
        include: receiverInclude
      })) as typeof receiver;
      if (!receiver || receiver.status !== SlateTriggerReceiverStatus.active) break;
      receiverTriggers = receiver.triggers
        .filter(
          trigger =>
            isRoutableWebhookReceiverTrigger(trigger) &&
            !d.excludeReceiverTriggerIds?.includes(trigger.id)
        )
        .map(trigger => ({ ...trigger, receiver }) as unknown as ReceiverTriggerWithRelations);
    }
    if (result.status !== 'rejected') {
      for (let trigger of receiverTriggers) {
        await d.onReceiverTriggerCompleted?.(trigger.id);
      }
    }
    return result;
  }

  async handleReceiverWebhook(d: {
    receiverId: string;
    request: TriggerWebhookRequestPayload;
    excludeReceiverTriggerIds?: string[];
    onReceiverTriggerCompleted?: (receiverTriggerId: string) => Promise<void>;
  }) {
    let receiver = await db.slateTriggerReceiver.findFirst({
      where: {
        id: d.receiverId
      },
      include: receiverInclude
    });
    if (!receiver) throw new ServiceError(notFoundError('slate.trigger.receiver'));
    if (receiver.status !== SlateTriggerReceiverStatus.active) return;

    let webhookTriggers = receiver.triggers.filter(
      trigger =>
        isRoutableWebhookReceiverTrigger(trigger) &&
        webhookTriggerAllowsMethod(trigger.action, d.request.method) &&
        !d.excludeReceiverTriggerIds?.includes(trigger.id)
    );

    for (let trigger of webhookTriggers) {
      try {
        await this.handleWebhookForReceiverTrigger({
          receiverTrigger: {
            ...trigger,
            receiver
          } as ReceiverTriggerWithRelations,
          request: d.request
        });
        await d.onReceiverTriggerCompleted?.(trigger.id);
      } catch (error) {
        Sentry.captureException(new Error('Receiver webhook fanout failed'), {
          extra: {
            receiverId: receiver.id,
            receiverTriggerId: trigger.id
          }
        });
        console.error('Failed to fan out trigger webhook:', {
          receiverId: receiver.id,
          receiverTriggerId: trigger.id,
          errorCode: 'webhook_fanout_failed'
        });
        // Queue processing supplies a checkpoint callback and must retry the uncheckpointed
        // remainder. Preserve the existing best-effort behavior for direct internal callers.
        if (d.onReceiverTriggerCompleted) throw error;
      }
    }
  }
}
