import { createHash, timingSafeEqual } from 'node:crypto';
import {
  SAFE_WEBHOOK_REJECTION_CODES,
  SLATE_WEBHOOK_PROVIDER_VERIFIER_DEFINITIONS,
  SLATE_WEBHOOK_PRESET_DEFINITIONS,
  canonicalizeJsonJcs,
  computeDispatchWebhookRequestHash,
  computeOriginalWebhookRequestHash,
  hashWebhookWireResponseV1,
  parseWebhookWireRequest,
  parseWebhookWireResponse,
  type SafeWebhookRejectionCode,
  type SlateWebhookProviderRule,
  type SlateWebhookIngress,
  type SlateWebhookVerification,
  type SlateWebhookVerificationRule,
  type WebhookWireRequest,
  type WebhookWireResponse
} from '@slates/proto';
import z from 'zod';
import { verifyEd25519 } from './ed25519';
import {
  prepareWebhookItemAdapter,
  validateSelectedWebhookCandidates,
  type PreparedWebhookItemAdapter,
  type WebhookItemCandidate
} from './itemAdapters';
import { renderPresetSyncResponse, verifyWebhookPreset } from './presets';
import type { GraphWebhookAuthorityBinding } from './presets';
import { verifyRawHmac } from './rawHmac';
import {
  parseWebhookJsonBody,
  resolveJsonPointer,
  selectExactWebhookRule,
  type ExactWebhookRule,
  type ResolvedWebhookSecret,
  type WebhookVerificationResult,
  type WebhookVerifiedSelection
} from './ruleSelection';
import { verifyStaticToken } from './staticToken';

export * from './ed25519';
export * from './itemAdapters';
export * from './presets';
export * from './rawHmac';
export * from './ruleSelection';
export * from './staticToken';

export type ExactSharedAppAuthority = Readonly<{
  routeProjectionId: string;
  routeGeneration: number;
  routeProjectionDigest: string;
  bindingProjectionId: string;
  bindingGeneration: number;
  bindingProjectionDigest: string;
  externalOwnershipKey: string;
  authenticatedPathSecretIds: readonly string[];
  authenticatedVendorSecretIds: readonly string[];
  bindingHash: string;
}>;

type ExactWebhookVerification =
  | SlateWebhookVerification
  | Extract<SlateWebhookIngress, { kind: 'shared_provisioned_app' }>['verification'];

export type ExactWebhookTriggerProjection = Readonly<{
  receiverId: string;
  receiverTriggerId: string;
  actionId: string;
  specHash: string;
  registrationStatus: string;
  registrationGeneration: number;
  registrationVersion: number;
  verification: ExactWebhookVerification;
  secrets: readonly ResolvedWebhookSecret[];
  actionInputSchema: Record<string, unknown>;
  state: unknown;
  stateVersion: number;
  stateHash: string;
  graphAuthorities?: readonly GraphWebhookAuthorityBinding[];
  sharedAppAuthority?: ExactSharedAppAuthority;
}>;

export type ExactWebhookRuleBinding = Readonly<{
  receiverId: string;
  receiverTriggerId: string;
  actionId: string;
  specHash: string;
  registrationGeneration: number;
  registrationVersion: number;
  ruleId: string;
  requestId: string;
  originalRequestHash: string;
  dispatchRequestHash: string;
  itemAdapterId?: 'graph.body_value.v1';
  selectedItems: readonly WebhookItemCandidate[];
  sharedAppAuthority?: ExactSharedAppAuthority;
}>;

export type ExactWebhookMappedOutput = Readonly<{
  bindings: ExactWebhookRuleBinding;
  inputs: readonly Record<string, unknown>[];
  proposedState?: {
    value: unknown;
    expectedPriorVersion: number;
    expectedPriorHash: string;
  };
}>;

export type WebhookAtomicDispatch = Readonly<{
  bindings: ExactWebhookRuleBinding;
  acceptedRequest: WebhookWireRequest;
  inputs: readonly Record<string, unknown>[];
  replayKeys: readonly string[];
  replayTtlSeconds: number;
  proposedState?: ExactWebhookMappedOutput['proposedState'];
}>;

export type WebhookAtomicSync = Readonly<{
  bindings: Omit<ExactWebhookRuleBinding, 'dispatchRequestHash'> & {
    dispatchRequestHash: string;
  };
  response: WebhookWireResponse;
  capturedSecrets: Readonly<Record<string, string>>;
  replayKeys: readonly string[];
  replayTtlSeconds: number;
  replayClaim?: Readonly<{
    deliveryIds: readonly string[];
    freshnessTimestampMs?: number;
  }>;
}>;

export type WebhookAtomicCommitInput = Readonly<{
  requestId: string;
  receiverId: string;
  originalRequestHash: string;
  dispatches: readonly WebhookAtomicDispatch[];
  syncs: readonly WebhookAtomicSync[];
}>;

export type WebhookAtomicCommitResult =
  | { status: 'committed'; commitId: string }
  | { status: 'duplicate'; commitId: string; response?: WebhookWireResponse }
  | {
      status: 'rejected';
      code: 'replay_conflict' | 'state_cas_conflict' | 'mapped_output_invalid';
    };

export interface WebhookAtomicCommitSeam {
  commit(input: WebhookAtomicCommitInput): Promise<WebhookAtomicCommitResult>;
}

export type ExactWebhookPipelineDependencies = Readonly<{
  lookupReplay?(d: {
    bindings: ExactWebhookRuleBinding;
    replayKeys: readonly string[];
    selectedItems: readonly WebhookItemCandidate[];
    kind: 'sync_response' | 'dispatch';
  }): Promise<{
    duplicateCandidateIds: readonly string[];
    response?: WebhookWireResponse;
  }>;
  verifyProvider(d: {
    trigger: ExactWebhookTriggerProjection;
    rule: SlateWebhookProviderRule;
    request: WebhookWireRequest;
    requestId: string;
    originalRequestHash: string;
    itemAdapter?: PreparedWebhookItemAdapter;
  }): Promise<unknown>;
  mapProvider(d: {
    trigger: ExactWebhookTriggerProjection;
    rule: ExactWebhookRule;
    request: WebhookWireRequest;
    bindings: ExactWebhookRuleBinding;
    state: unknown;
    stateVersion: number;
    stateHash: string;
  }): Promise<unknown>;
  captureBootstrap?(d: {
    trigger: ExactWebhookTriggerProjection;
    rule: ExactWebhookRule;
    request: WebhookWireRequest;
    bindings: ExactWebhookRuleBinding;
    selection: WebhookVerifiedSelection;
  }): Promise<unknown>;
  atomicCommit: WebhookAtomicCommitSeam;
}>;

export type ExactWebhookPipelineResult =
  | {
      status: 'committed' | 'duplicate';
      response?: WebhookWireResponse;
    }
  | {
      status: 'rejected';
      code: SafeWebhookRejectionCode;
    };

let SAFE_CODES = new Set<string>(SAFE_WEBHOOK_REJECTION_CODES);

let safeRejected = (
  value: unknown
): value is { status: 'rejected'; code: SafeWebhookRejectionCode } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (value as Record<string, unknown>).status === 'rejected' &&
  typeof (value as Record<string, unknown>).code === 'string' &&
  SAFE_CODES.has((value as Record<string, unknown>).code as string) &&
  Object.keys(value).every(key => key === 'status' || key === 'code');

let adapterIdForRule = (rule: ExactWebhookRule) => {
  if (rule.result.type !== 'dispatch' || rule.result.scope !== 'verified_items') {
    return undefined;
  }
  if (rule.verify.type === 'preset') {
    let definition = SLATE_WEBHOOK_PRESET_DEFINITIONS[rule.verify.preset];
    return 'itemAdapterId' in definition ? definition.itemAdapterId : undefined;
  }
  if (rule.verify.type === 'provider') {
    let definition = SLATE_WEBHOOK_PROVIDER_VERIFIER_DEFINITIONS[rule.verify.verifierId];
    return 'itemAdapterId' in definition ? definition.itemAdapterId : undefined;
  }
  return undefined;
};

let pathSecretDigest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

export let verifyReceiverPathSecret = (d: {
  supplied: string;
  activeAndRetiring: readonly string[];
}) => {
  let suppliedDigest = pathSecretDigest(d.supplied);
  let matched = 0;
  for (let candidate of d.activeAndRetiring) {
    matched |= Number(timingSafeEqual(suppliedDigest, pathSecretDigest(candidate)));
  }
  return d.activeAndRetiring.length > 0 && matched !== 0;
};

export let verifyHubWebhookRule = (d: {
  rule: SlateWebhookVerificationRule;
  request: WebhookWireRequest;
  secrets: readonly ResolvedWebhookSecret[];
  itemAdapter?: PreparedWebhookItemAdapter;
  graphAuthorities?: readonly GraphWebhookAuthorityBinding[];
  registrationGeneration?: number;
  specHash?: string;
}): WebhookVerificationResult => {
  if (d.rule.verify.type === 'path_secret') {
    return { status: 'accepted', selection: { scope: 'receiver_trigger' } };
  }
  if (d.rule.verify.type === 'static_token') {
    return verifyStaticToken({
      request: d.request,
      verifier: d.rule.verify,
      secrets: d.secrets
    });
  }
  if (d.rule.verify.type === 'raw_hmac') {
    return verifyRawHmac({
      request: d.request,
      verifier: d.rule.verify,
      secrets: d.secrets
    });
  }
  if (d.rule.verify.type === 'ed25519') {
    return verifyEd25519({
      request: d.request,
      verifier: d.rule.verify,
      secrets: d.secrets
    });
  }
  return verifyWebhookPreset({
    preset: d.rule.verify.preset,
    request: d.request,
    secrets: d.secrets,
    itemAdapter: d.itemAdapter,
    graphAuthorities: d.graphAuthorities,
    registrationGeneration: d.registrationGeneration,
    specHash: d.specHash
  });
};

export let validateProviderWebhookVerification = (d: {
  result: unknown;
  rule: SlateWebhookProviderRule;
  itemAdapter?: PreparedWebhookItemAdapter;
}): WebhookVerificationResult => {
  if (safeRejected(d.result)) return d.result;
  if (typeof d.result !== 'object' || d.result === null || Array.isArray(d.result)) {
    return { status: 'rejected', code: 'provider_invalid_result' };
  }
  let result = d.result as Record<string, unknown>;
  if (
    result.status !== 'accepted' ||
    Object.keys(result).some(
      key => key !== 'status' && key !== 'selection' && key !== 'presetFields'
    ) ||
    typeof result.selection !== 'object' ||
    result.selection === null ||
    Array.isArray(result.selection)
  ) {
    return { status: 'rejected', code: 'provider_invalid_result' };
  }
  let presetFields = result.presetFields;
  let allowedPresetFields = new Set(
    SLATE_WEBHOOK_PROVIDER_VERIFIER_DEFINITIONS[d.rule.verify.verifierId]?.presetFields ?? []
  );
  if (
    (presetFields !== undefined &&
      (typeof presetFields !== 'object' ||
        presetFields === null ||
        Array.isArray(presetFields))) ||
    (presetFields !== undefined &&
      Object.entries(presetFields as Record<string, unknown>).some(
        ([key, value]) =>
          !allowedPresetFields.has(key as never) ||
          typeof value !== 'string' ||
          value.length === 0
      ))
  ) {
    return { status: 'rejected', code: 'provider_invalid_result' };
  }
  let selection = result.selection as Record<string, unknown>;
  let expectedScope =
    d.rule.result.type === 'dispatch' ? d.rule.result.scope : 'receiver_trigger';
  if (selection.scope !== expectedScope) {
    return { status: 'rejected', code: 'provider_invalid_result' };
  }
  if (expectedScope === 'receiver_trigger') {
    return Object.keys(selection).length === 1
      ? {
          status: 'accepted',
          selection: { scope: 'receiver_trigger' },
          ...(presetFields
            ? { presetFields: presetFields as Readonly<Record<string, string>> }
            : {})
        }
      : { status: 'rejected', code: 'provider_invalid_result' };
  }
  if (
    selection.itemAdapterId !== d.itemAdapter?.id ||
    !Array.isArray(selection.acceptedCandidateIds) ||
    selection.acceptedCandidateIds.some(candidateId => typeof candidateId !== 'string') ||
    Object.keys(selection).some(
      key => !['scope', 'itemAdapterId', 'acceptedCandidateIds'].includes(key)
    )
  ) {
    return { status: 'rejected', code: 'provider_invalid_result' };
  }
  let validated = validateSelectedWebhookCandidates({
    candidates: d.itemAdapter!.candidates,
    acceptedCandidateIds: selection.acceptedCandidateIds as string[]
  });
  return validated.status === 'accepted'
    ? {
        status: 'accepted',
        selection: {
          scope: 'verified_items',
          itemAdapterId: 'graph.body_value.v1',
          acceptedCandidateIds: selection.acceptedCandidateIds as string[]
        },
        ...(presetFields
          ? { presetFields: presetFields as Readonly<Record<string, string>> }
          : {})
      }
    : validated;
};

let exactBindings = (first: ExactWebhookRuleBinding, second: ExactWebhookRuleBinding) =>
  canonicalizeJsonJcs(first) === canonicalizeJsonJcs(second);

let parseBootstrapReplayClaim = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  let claim = value as Record<string, unknown>;
  if (
    Object.keys(claim).some(key => !['deliveryIds', 'freshnessTimestampMs'].includes(key)) ||
    !Array.isArray(claim.deliveryIds) ||
    claim.deliveryIds.length === 0 ||
    claim.deliveryIds.some(id => typeof id !== 'string' || id.length === 0) ||
    new Set(claim.deliveryIds).size !== claim.deliveryIds.length ||
    (claim.freshnessTimestampMs !== undefined &&
      (!Number.isSafeInteger(claim.freshnessTimestampMs) ||
        (claim.freshnessTimestampMs as number) < 0))
  ) {
    return null;
  }
  return {
    deliveryIds: claim.deliveryIds as string[],
    ...(typeof claim.freshnessTimestampMs === 'number'
      ? { freshnessTimestampMs: claim.freshnessTimestampMs }
      : {})
  };
};

let parseMappingOutput = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  let output = value as Record<string, unknown>;
  if (
    Object.keys(output).some(key => !['bindings', 'inputs', 'proposedState'].includes(key)) ||
    typeof output.bindings !== 'object' ||
    output.bindings === null ||
    Array.isArray(output.bindings) ||
    !Array.isArray(output.inputs) ||
    output.inputs.some(
      input => typeof input !== 'object' || input === null || Array.isArray(input)
    )
  ) {
    return null;
  }
  return output as unknown as ExactWebhookMappedOutput;
};

export let validateExactWebhookMappedOutput = (d: {
  value: unknown;
  expectedBindings: ExactWebhookRuleBinding;
  actionInputSchema: Record<string, unknown>;
  expectedStateVersion: number;
  expectedStateHash: string;
}):
  | { status: 'accepted'; output: ExactWebhookMappedOutput }
  | {
      status: 'rejected';
      code: 'mapped_output_invalid' | 'mapped_output_incomplete' | 'mapped_output_extra';
    } => {
  let output = parseMappingOutput(d.value);
  if (!output || !exactBindings(output.bindings, d.expectedBindings)) {
    return { status: 'rejected', code: 'mapped_output_invalid' };
  }
  if (d.expectedBindings.itemAdapterId) {
    let expectedIds = d.expectedBindings.selectedItems.map(item => item.candidateId);
    let actualIds = output.inputs.map(input => input.candidateId);
    if (actualIds.some(candidateId => typeof candidateId !== 'string')) {
      return { status: 'rejected', code: 'mapped_output_invalid' };
    }
    if (new Set(actualIds).size !== actualIds.length) {
      return { status: 'rejected', code: 'mapped_output_extra' };
    }
    if (actualIds.some(candidateId => !expectedIds.includes(candidateId as string))) {
      return { status: 'rejected', code: 'mapped_output_extra' };
    }
    if (expectedIds.some(candidateId => !actualIds.includes(candidateId))) {
      return { status: 'rejected', code: 'mapped_output_incomplete' };
    }
  }
  let validator: z.ZodType;
  try {
    validator = z.fromJSONSchema(d.actionInputSchema);
  } catch {
    return { status: 'rejected', code: 'mapped_output_invalid' };
  }
  if (output.inputs.some(input => !validator.safeParse(input).success)) {
    return { status: 'rejected', code: 'mapped_output_invalid' };
  }
  if (
    output.proposedState &&
    (output.proposedState.expectedPriorVersion !== d.expectedStateVersion ||
      output.proposedState.expectedPriorHash !== d.expectedStateHash)
  ) {
    return { status: 'rejected', code: 'mapped_output_invalid' };
  }
  return { status: 'accepted', output };
};

let baseBindings = (d: {
  trigger: ExactWebhookTriggerProjection;
  ruleId: string;
  requestId: string;
  originalRequestHash: string;
  dispatchRequestHash: string;
  selectedItems?: readonly WebhookItemCandidate[];
  itemAdapterId?: 'graph.body_value.v1';
}): ExactWebhookRuleBinding => ({
  receiverId: d.trigger.receiverId,
  receiverTriggerId: d.trigger.receiverTriggerId,
  actionId: d.trigger.actionId,
  specHash: d.trigger.specHash,
  registrationGeneration: d.trigger.registrationGeneration,
  registrationVersion: d.trigger.registrationVersion,
  ruleId: d.ruleId,
  requestId: d.requestId,
  originalRequestHash: d.originalRequestHash,
  dispatchRequestHash: d.dispatchRequestHash,
  ...(d.itemAdapterId ? { itemAdapterId: d.itemAdapterId } : {}),
  selectedItems: d.selectedItems ?? [],
  ...(d.trigger.sharedAppAuthority ? { sharedAppAuthority: d.trigger.sharedAppAuthority } : {})
});

let syncResponseForHubRule = (d: {
  rule: SlateWebhookVerificationRule;
  request: WebhookWireRequest;
  secrets: readonly ResolvedWebhookSecret[];
}) => {
  if (d.rule.verify.type === 'preset') {
    let preset = renderPresetSyncResponse({
      preset: d.rule.verify.preset,
      request: d.request,
      secrets: d.secrets
    });
    if (preset) return preset;
  }
  let url = new URL(d.request.url);
  for (let parameter of ['hub.challenge', 'validationToken']) {
    let values = url.searchParams.getAll(parameter);
    if (values.length === 1) {
      return {
        status: 200,
        headers: [['content-type', 'text/plain; charset=utf-8']],
        body: { present: true, base64: Buffer.from(values[0]!, 'utf8').toString('base64') }
      } satisfies WebhookWireResponse;
    }
  }
  if (d.request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: [],
      body: { present: true, base64: '' }
    } satisfies WebhookWireResponse;
  }
  return null;
};

let exactReplaySourceValue = (d: {
  source:
    | { source: 'preset'; presetField: string }
    | { source: 'header'; headerName: string }
    | { source: 'json_pointer'; pointer: string };
  verification: WebhookVerificationResult;
  request: WebhookWireRequest;
}) => {
  if (d.source.source === 'preset') {
    return d.verification.status === 'accepted'
      ? d.verification.presetFields?.[d.source.presetField]
      : undefined;
  }
  if (d.source.source === 'header') {
    let headerName = d.source.headerName;
    let values = d.request.headers.filter(
      ([name]) => name.toLowerCase() === headerName.toLowerCase()
    );
    return values.length === 1 ? values[0]![1] : undefined;
  }
  try {
    let value = resolveJsonPointer(parseWebhookJsonBody(d.request), d.source.pointer);
    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  } catch {
    return undefined;
  }
};

let replayTtlSecondsFor = (rule: ExactWebhookRule) =>
  rule.replay?.kind === 'enforced' && rule.replay.deduplicate
    ? rule.replay.deduplicate.ttlSeconds
    : 300;

let enforceDeclaredAuthenticatedFreshness = (d: {
  rule: ExactWebhookRule;
  verification: WebhookVerificationResult;
  request: WebhookWireRequest;
  nowMs: number;
}): WebhookVerificationResult => {
  if (d.verification.status !== 'accepted' || d.rule.replay?.kind !== 'enforced') {
    return d.verification;
  }
  let freshness = d.rule.replay.freshness;
  if (!freshness) return d.verification;
  let raw = exactReplaySourceValue({
    source: freshness,
    verification: d.verification,
    request: d.request
  });
  if (raw === undefined) return { status: 'rejected', code: 'credential_invalid' };
  let timestampMs: number;
  if (freshness.format === 'rfc3339') {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(raw)) {
      return { status: 'rejected', code: 'credential_invalid' };
    }
    timestampMs = Date.parse(raw);
  } else {
    if (!/^(?:0|[1-9]\d{0,15})$/.test(raw)) {
      return { status: 'rejected', code: 'credential_invalid' };
    }
    let parsed = Number(raw);
    timestampMs = freshness.format === 'unix_seconds' ? parsed * 1000 : parsed;
  }
  if (!Number.isSafeInteger(timestampMs)) {
    return { status: 'rejected', code: 'credential_invalid' };
  }
  if (timestampMs > d.nowMs + freshness.maxFutureSkewSeconds * 1000) {
    return { status: 'rejected', code: 'credential_future' };
  }
  if (timestampMs < d.nowMs - freshness.maxAgeSeconds * 1000) {
    return { status: 'rejected', code: 'credential_stale' };
  }
  return d.verification;
};

let replayKeysFor = (d: {
  trigger: ExactWebhookTriggerProjection;
  rule: ExactWebhookRule;
  selected: readonly WebhookItemCandidate[];
  verification: WebhookVerificationResult;
  request: WebhookWireRequest;
  originalRequestHash: string;
}) => {
  if (d.selected.length > 0) {
    return d.selected.flatMap(candidate =>
      candidate.deliveryIds.map(
        deliveryId => `${d.trigger.receiverTriggerId}:${d.rule.id}:${deliveryId}`
      )
    );
  }
  if (d.rule.replay?.kind === 'enforced' && d.rule.replay.deduplicate) {
    let value = exactReplaySourceValue({
      source: d.rule.replay.deduplicate,
      verification: d.verification,
      request: d.request
    });
    if (value) return [`${d.trigger.receiverTriggerId}:${d.rule.id}:${value}`];
  }
  return [`${d.trigger.receiverTriggerId}:${d.rule.id}:${d.originalRequestHash}`];
};

type SelectedTrigger = {
  trigger: ExactWebhookTriggerProjection;
  rule: ExactWebhookRule | null;
};

type VerifiedTrigger = SelectedTrigger & {
  verification: WebhookVerificationResult;
  itemAdapter?: PreparedWebhookItemAdapter;
  request: WebhookWireRequest;
  selected: readonly WebhookItemCandidate[];
  bindings: ExactWebhookRuleBinding;
};

export let executeExactWebhookPipeline = async (d: {
  receiverId: string;
  requestId: string;
  request: WebhookWireRequest;
  triggers: readonly ExactWebhookTriggerProjection[];
  dependencies: ExactWebhookPipelineDependencies;
}): Promise<ExactWebhookPipelineResult> => {
  let request = parseWebhookWireRequest(d.request);
  let originalRequestHash = computeOriginalWebhookRequestHash(request);
  let rejectPipeline = (code: SafeWebhookRejectionCode): ExactWebhookPipelineResult => ({
    status: 'rejected',
    code
  });
  let selected: SelectedTrigger[] = [];
  let firstRejection: SafeWebhookRejectionCode | undefined;
  for (let trigger of [...d.triggers].sort((first, second) =>
    first.receiverTriggerId.localeCompare(second.receiverTriggerId)
  )) {
    if (trigger.receiverId !== d.receiverId) continue;
    if (trigger.verification.mechanism === 'path_secret_only') {
      selected.push({ trigger, rule: null });
      continue;
    }
    let result = selectExactWebhookRule({
      rules: trigger.verification.rules,
      request,
      registrationStatus: trigger.registrationStatus
    });
    if (result.status === 'rejected') {
      firstRejection ??= result.code;
      continue;
    }
    selected.push({ trigger, rule: result.rule });
  }
  if (selected.length === 0) {
    return rejectPipeline(firstRejection ?? 'no_matching_rule');
  }
  let verified: VerifiedTrigger[] = [];
  for (let item of selected) {
    let { trigger, rule } = item;
    let ruleId = rule?.id ?? 'path_secret_only';
    let itemAdapter: PreparedWebhookItemAdapter | undefined;
    let adapterId = rule ? adapterIdForRule(rule) : undefined;
    if (adapterId) {
      try {
        itemAdapter = prepareWebhookItemAdapter(adapterId, request);
      } catch {
        firstRejection ??= 'item_adapter_invalid';
        continue;
      }
    }
    let verification: WebhookVerificationResult;
    if (!rule) {
      verification = { status: 'accepted', selection: { scope: 'receiver_trigger' } };
    } else if (rule.verify.type === 'provider') {
      let providerRule = rule as SlateWebhookProviderRule;
      let graphAuthority = itemAdapter
        ? verifyWebhookPreset({
            preset: 'graph.change_notification.v1',
            request,
            secrets: [],
            itemAdapter,
            graphAuthorities: trigger.graphAuthorities,
            registrationGeneration: trigger.registrationGeneration,
            specHash: trigger.specHash
          })
        : undefined;
      if (graphAuthority?.status === 'rejected') {
        verification = graphAuthority;
      } else {
        try {
          verification = validateProviderWebhookVerification({
            result: await d.dependencies.verifyProvider({
              trigger,
              rule: providerRule,
              request,
              requestId: d.requestId,
              originalRequestHash,
              itemAdapter
            }),
            rule: providerRule,
            itemAdapter
          });
          let providerAcceptedCandidateIds =
            verification.status === 'accepted' &&
            verification.selection.scope === 'verified_items'
              ? verification.selection.acceptedCandidateIds
              : undefined;
          let authoritativeCandidateIds =
            graphAuthority?.status === 'accepted' &&
            graphAuthority.selection.scope === 'verified_items'
              ? graphAuthority.selection.acceptedCandidateIds
              : undefined;
          if (
            providerAcceptedCandidateIds?.some(
              candidateId => !authoritativeCandidateIds?.includes(candidateId)
            )
          ) {
            verification = { status: 'rejected', code: 'item_candidate_contradictory' };
          }
        } catch (error) {
          verification = {
            status: 'rejected',
            code: String(error).toLowerCase().includes('timeout')
              ? 'provider_timeout'
              : 'provider_error'
          };
        }
      }
    } else {
      let hubRule = rule as SlateWebhookVerificationRule;
      verification = verifyHubWebhookRule({
        rule: hubRule,
        request,
        secrets: trigger.secrets,
        itemAdapter,
        graphAuthorities: trigger.graphAuthorities,
        registrationGeneration: trigger.registrationGeneration,
        specHash: trigger.specHash
      });
    }
    if (rule) {
      // Authentication has completed at this point. Only now may a timestamp or delivery ID
      // source influence freshness/replay decisions.
      verification = enforceDeclaredAuthenticatedFreshness({
        rule,
        verification,
        request,
        nowMs: Date.now()
      });
    }
    let acceptedIds =
      verification.status === 'accepted' && verification.selection.scope === 'verified_items'
        ? verification.selection.acceptedCandidateIds
        : undefined;
    let reconstructed = acceptedIds
      ? itemAdapter!.reconstruct(acceptedIds)
      : {
          request,
          selected: [] as readonly WebhookItemCandidate[],
          dispatchRequestHash: computeDispatchWebhookRequestHash(request)
        };
    let bindings = baseBindings({
      trigger,
      ruleId,
      requestId: d.requestId,
      originalRequestHash,
      dispatchRequestHash: reconstructed.dispatchRequestHash,
      itemAdapterId: itemAdapter?.id,
      selectedItems: reconstructed.selected
    });
    if (verification.status === 'accepted') {
      verified.push({
        ...item,
        verification,
        itemAdapter,
        request: reconstructed.request,
        selected: reconstructed.selected,
        bindings
      });
    } else {
      firstRejection ??= verification.code;
    }
  }

  // A rule match is routing evidence, not authorization. Aggregate outcomes only after each
  // trigger's exact verifier has accepted it; otherwise an unauthenticated sibling could turn a
  // matcher-only dispatch rule into a receiver-wide denial of a valid bootstrap response.
  let authorizedOutcomeTypes = new Set(
    verified.map(item => item.rule?.result.type ?? 'dispatch')
  );
  if (authorizedOutcomeTypes.size > 1) {
    return rejectPipeline('conflicting_rule_outcomes');
  }

  let authorized = verified;
  if (authorized.length === 0) return rejectPipeline(firstRejection ?? 'credential_invalid');

  let duplicateResponses: WebhookWireResponse[] = [];
  if (d.dependencies.lookupReplay) {
    let fresh: VerifiedTrigger[] = [];
    for (let item of authorized) {
      let rule = item.rule;
      let replayKeys = rule
        ? replayKeysFor({
            trigger: item.trigger,
            rule,
            selected: item.selected,
            verification: item.verification,
            request: item.request,
            originalRequestHash
          })
        : [`${item.trigger.receiverTriggerId}:${originalRequestHash}`];
      let replay = await d.dependencies.lookupReplay({
        bindings: item.bindings,
        replayKeys,
        selectedItems: item.selected,
        kind: rule?.result.type === 'sync_only' ? 'sync_response' : 'dispatch'
      });
      if (replay.response) duplicateResponses.push(replay.response);
      if (item.selected.length === 0) {
        if (!replay.duplicateCandidateIds.includes('receiver:0')) fresh.push(item);
        continue;
      }
      let duplicateIds = new Set(replay.duplicateCandidateIds);
      let freshIds = item.selected
        .map(candidate => candidate.candidateId)
        .filter(candidateId => !duplicateIds.has(candidateId));
      if (freshIds.length === 0) continue;
      let reconstructed = item.itemAdapter!.reconstruct(freshIds);
      fresh.push({
        ...item,
        request: reconstructed.request,
        selected: reconstructed.selected,
        bindings: {
          ...item.bindings,
          dispatchRequestHash: reconstructed.dispatchRequestHash,
          selectedItems: reconstructed.selected
        }
      });
    }
    authorized = fresh;
    if (authorized.length === 0) {
      let hashes = new Set(duplicateResponses.map(hashWebhookWireResponseV1));
      if (hashes.size > 1) return rejectPipeline('replay_conflict');
      return {
        status: 'duplicate',
        ...(duplicateResponses[0] ? { response: duplicateResponses[0] } : {})
      };
    }
  }

  let syncs: WebhookAtomicSync[] = [];
  let dispatches: WebhookAtomicDispatch[] = [];
  for (let item of authorized) {
    let rule = item.rule;
    if (!rule) {
      let mappedValue: unknown;
      try {
        mappedValue = await d.dependencies.mapProvider({
          trigger: item.trigger,
          rule: {
            id: 'path_secret_only',
            phase: 'delivery',
            when: { methods: [request.method] },
            verify: { type: 'path_secret' },
            result: { type: 'dispatch', scope: 'receiver_trigger' },
            replay: {
              kind: 'enforced',
              deduplicate: {
                source: 'header',
                headerName: 'x-metorial-delivery-id',
                ttlSeconds: 1,
                scope: 'request'
              }
            }
          } as never,
          request: item.request,
          bindings: item.bindings,
          state: item.trigger.state,
          stateVersion: item.trigger.stateVersion,
          stateHash: item.trigger.stateHash
        });
      } catch (error) {
        return rejectPipeline(
          String(error).toLowerCase().includes('timeout')
            ? 'provider_timeout'
            : 'provider_error'
        );
      }
      let mapped = validateExactWebhookMappedOutput({
        value: mappedValue,
        expectedBindings: item.bindings,
        actionInputSchema: item.trigger.actionInputSchema,
        expectedStateVersion: item.trigger.stateVersion,
        expectedStateHash: item.trigger.stateHash
      });
      if (mapped.status === 'rejected') {
        return rejectPipeline(mapped.code);
      }
      dispatches.push({
        bindings: item.bindings,
        acceptedRequest: item.request,
        inputs: mapped.output.inputs,
        replayKeys: [`${item.trigger.receiverTriggerId}:${originalRequestHash}`],
        replayTtlSeconds: 1,
        proposedState: mapped.output.proposedState
      });
      continue;
    }
    if (rule.result.type === 'sync_only') {
      let response: WebhookWireResponse | null = null;
      let capturedSecrets: Record<string, string> = {};
      let replayClaim: ReturnType<typeof parseBootstrapReplayClaim> = undefined;
      let replayKeys = replayKeysFor({
        trigger: item.trigger,
        rule,
        selected: item.selected,
        verification: item.verification,
        request: item.request,
        originalRequestHash
      });
      if (rule.verify.type === 'provider') {
        let capture: unknown;
        try {
          capture = await d.dependencies.captureBootstrap?.({
            trigger: item.trigger,
            rule,
            request,
            bindings: item.bindings,
            selection:
              item.verification.status === 'accepted'
                ? item.verification.selection
                : { scope: 'receiver_trigger' }
          });
        } catch {
          return rejectPipeline('provider_error');
        }
        if (
          typeof capture !== 'object' ||
          capture === null ||
          Array.isArray(capture) ||
          (capture as Record<string, unknown>).status !== 'accepted'
        ) {
          return rejectPipeline('provider_invalid_result');
        }
        let acceptedCapture = capture as Record<string, unknown>;
        if (
          Object.keys(acceptedCapture).some(
            key =>
              !['status', 'bindings', 'capturedSecrets', 'response', 'replayClaim'].includes(
                key
              )
          ) ||
          typeof acceptedCapture.bindings !== 'object' ||
          acceptedCapture.bindings === null ||
          Array.isArray(acceptedCapture.bindings) ||
          !exactBindings(
            acceptedCapture.bindings as unknown as ExactWebhookRuleBinding,
            item.bindings
          )
        ) {
          return rejectPipeline('provider_invalid_result');
        }
        try {
          response = parseWebhookWireResponse(acceptedCapture.response);
        } catch {
          return rejectPipeline('provider_invalid_result');
        }
        if (
          typeof acceptedCapture.capturedSecrets !== 'object' ||
          acceptedCapture.capturedSecrets === null ||
          Array.isArray(acceptedCapture.capturedSecrets)
        ) {
          return rejectPipeline('provider_invalid_result');
        }
        capturedSecrets = acceptedCapture.capturedSecrets as typeof capturedSecrets;
        replayClaim = parseBootstrapReplayClaim(acceptedCapture.replayClaim);
        if (replayClaim === null) {
          return rejectPipeline('provider_invalid_result');
        }
        let allowedCaptureNames = new Set(rule.verify.allowedBootstrapCaptureRefs);
        if (
          Object.entries(capturedSecrets).some(
            ([name, captured]) =>
              !allowedCaptureNames.has(name) ||
              typeof captured !== 'string' ||
              captured.length === 0
          )
        ) {
          return rejectPipeline('provider_invalid_result');
        }
      } else {
        let hubRule = rule as SlateWebhookVerificationRule;
        response = syncResponseForHubRule({
          rule: hubRule,
          request,
          secrets: item.trigger.secrets
        });
      }
      if (!response) return rejectPipeline('mapped_output_invalid');
      syncs.push({
        bindings: item.bindings,
        response,
        capturedSecrets,
        replayKeys,
        replayTtlSeconds: replayTtlSecondsFor(rule),
        ...(replayClaim ? { replayClaim } : {})
      });
      continue;
    }
    let mappedValue: unknown;
    try {
      mappedValue = await d.dependencies.mapProvider({
        trigger: item.trigger,
        rule,
        request: item.request,
        bindings: item.bindings,
        state: item.trigger.state,
        stateVersion: item.trigger.stateVersion,
        stateHash: item.trigger.stateHash
      });
    } catch (error) {
      return rejectPipeline(
        String(error).toLowerCase().includes('timeout') ? 'provider_timeout' : 'provider_error'
      );
    }
    let mapped = validateExactWebhookMappedOutput({
      value: mappedValue,
      expectedBindings: item.bindings,
      actionInputSchema: item.trigger.actionInputSchema,
      expectedStateVersion: item.trigger.stateVersion,
      expectedStateHash: item.trigger.stateHash
    });
    if (mapped.status === 'rejected') {
      return rejectPipeline(mapped.code);
    }
    dispatches.push({
      bindings: item.bindings,
      acceptedRequest: item.request,
      inputs: mapped.output.inputs,
      replayKeys: replayKeysFor({
        trigger: item.trigger,
        rule,
        selected: item.selected,
        verification: item.verification,
        request: item.request,
        originalRequestHash
      }),
      replayTtlSeconds: replayTtlSecondsFor(rule),
      proposedState: mapped.output.proposedState
    });
  }

  if (syncs.length > 0) {
    let responseHashes = new Set(syncs.map(sync => hashWebhookWireResponseV1(sync.response)));
    if (responseHashes.size !== 1) {
      return rejectPipeline('conflicting_sync_responses');
    }
  }
  let commit = await d.dependencies.atomicCommit.commit({
    requestId: d.requestId,
    receiverId: d.receiverId,
    originalRequestHash,
    dispatches,
    syncs
  });
  if (commit.status === 'rejected') return rejectPipeline(commit.code);
  return {
    status: commit.status,
    ...(commit.status === 'duplicate' && commit.response
      ? { response: commit.response }
      : syncs[0]
        ? { response: syncs[0].response }
        : {})
  };
};

export let computeWebhookStateHash = (state: unknown) =>
  createHash('sha256')
    .update('metorial.webhook-trigger-state\0v1\0')
    .update(canonicalizeJsonJcs(state))
    .digest('hex');

export let createUnavailableWebhookAtomicCommitSeam = (): WebhookAtomicCommitSeam => ({
  commit: async () => ({ status: 'rejected', code: 'mapped_output_invalid' })
});

export let createInMemoryWebhookAtomicCommitSeam = (initial?: {
  states?: Record<string, { version: number; hash: string; value: unknown }>;
}) => {
  let replay = new Map<string, { requestHash: string; commitId: string }>();
  let states = new Map(Object.entries(initial?.states ?? {}));
  let committed: WebhookAtomicCommitInput[] = [];
  let seam: WebhookAtomicCommitSeam = {
    commit: async input => {
      let replayKeys = [
        ...input.dispatches.flatMap(dispatch => dispatch.replayKeys),
        ...input.syncs.flatMap(sync => sync.replayKeys)
      ];
      let existing = replayKeys.map(key => replay.get(key)).filter(Boolean);
      if (existing.some(value => value!.requestHash !== input.originalRequestHash)) {
        return { status: 'rejected', code: 'replay_conflict' };
      }
      if (replayKeys.length > 0 && existing.length === replayKeys.length) {
        return { status: 'duplicate', commitId: existing[0]!.commitId };
      }
      for (let dispatch of input.dispatches) {
        if (!dispatch.proposedState) continue;
        let current = states.get(dispatch.bindings.receiverTriggerId);
        if (
          !current ||
          current.version !== dispatch.proposedState.expectedPriorVersion ||
          current.hash !== dispatch.proposedState.expectedPriorHash
        ) {
          return { status: 'rejected', code: 'state_cas_conflict' };
        }
      }
      let commitId = createHash('sha256')
        .update('metorial.webhook-atomic-commit\0v1\0')
        .update(canonicalizeJsonJcs(input))
        .digest('hex');
      for (let key of replayKeys)
        replay.set(key, { requestHash: input.originalRequestHash, commitId });
      for (let dispatch of input.dispatches) {
        if (!dispatch.proposedState) continue;
        states.set(dispatch.bindings.receiverTriggerId, {
          version: dispatch.proposedState.expectedPriorVersion + 1,
          hash: computeWebhookStateHash(dispatch.proposedState.value),
          value: dispatch.proposedState.value
        });
      }
      committed.push(input);
      return { status: 'committed', commitId };
    }
  };
  return { seam, replay, states, committed };
};
