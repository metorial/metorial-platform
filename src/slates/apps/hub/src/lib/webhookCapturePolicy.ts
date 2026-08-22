import { createHash } from 'node:crypto';
import {
  canonicalizeJsonJcs,
  computeWebhookActionSpecHashV1,
  slatesWebhookHttp,
  type SlateWebhookProviderRule,
  type SlateWebhookVerificationRule
} from '@slates/proto';
import { SlateTriggerReceiverTriggerSource } from '../../prisma/generated/client';
import { db } from '../db';
import { isRoutableWebhookReceiverTrigger } from '../services/slateTriggerReceiverShared';
import { DEFAULT_WEBHOOK_BODY_LIMIT_BYTES } from './webhookRequestCapture';

export type WebhookDuplicateHeaderPolicy = {
  headerName: string;
  grammar: 'signature_multi_value_v1';
};
export type WebhookCapturePolicy = {
  version: 1;
  maxBodyBytes: number;
  duplicateSecurityHeaders: WebhookDuplicateHeaderPolicy[];
  specHashes: string[];
  ruleIds: string[];
  policyHash: string;
};

export class WebhookCapturePolicyError extends Error {
  constructor(
    readonly code: 'routing_projection_unavailable' | 'routing_projection_stale',
    message: string
  ) {
    super(message);
  }
}

type StoredWebhookAction = {
  spec: unknown;
  registrationStatus: string;
};

let duplicatePolicyForRule = (
  rule: SlateWebhookVerificationRule | SlateWebhookProviderRule
): WebhookDuplicateHeaderPolicy[] => {
  if (
    (rule.verify.type === 'raw_hmac' || rule.verify.type === 'ed25519') &&
    rule.verify.signature.duplicateHeaderPolicy === 'preserve' &&
    rule.verify.signature.multipleSignaturePolicy !== 'reject'
  ) {
    return [
      {
        headerName: rule.verify.signature.headerName.toLowerCase(),
        grammar: 'signature_multi_value_v1'
      }
    ];
  }
  return [];
};

let comparablePolicy = (policy: {
  maxBodyBytes: number;
  duplicateSecurityHeaders: WebhookDuplicateHeaderPolicy[];
}) =>
  canonicalizeJsonJcs({
    maxBodyBytes: policy.maxBodyBytes,
    duplicateSecurityHeaders: [...policy.duplicateSecurityHeaders].sort((a, b) =>
      a.headerName.localeCompare(b.headerName)
    )
  });

export let projectStoredWebhookActionCapturePolicy = (d: {
  action: unknown;
  registrationStatus: string;
  method: string;
}) => {
  let action = d.action as Record<string, any>;
  if (
    !action ||
    action.type !== 'action.trigger' ||
    action.invocation?.type !== 'webhook' ||
    typeof action.specHash !== 'string'
  ) {
    throw new WebhookCapturePolicyError(
      'routing_projection_unavailable',
      'Stored webhook action contract is unavailable'
    );
  }
  let computedSpecHash: string;
  try {
    computedSpecHash = computeWebhookActionSpecHashV1(action as never);
  } catch {
    throw new WebhookCapturePolicyError(
      'routing_projection_stale',
      'Stored webhook capture policy is invalid'
    );
  }
  if (computedSpecHash !== action.specHash) {
    throw new WebhookCapturePolicyError(
      'routing_projection_stale',
      'Stored webhook action contract hash is stale'
    );
  }

  let http;
  try {
    http = slatesWebhookHttp.parse(action.invocation.http ?? {});
  } catch {
    throw new WebhookCapturePolicyError(
      'routing_projection_stale',
      'Stored webhook capture policy is invalid'
    );
  }
  let ingress = http.ingress;
  if (!ingress) {
    let value = {
      maxBodyBytes: DEFAULT_WEBHOOK_BODY_LIMIT_BYTES,
      duplicateSecurityHeaders: [] as WebhookDuplicateHeaderPolicy[],
      ruleIds: ['path_secret_only']
    };
    return { ...value, specHash: action.specHash, comparable: comparablePolicy(value) };
  }
  let verification = ingress.verification;
  if (verification.mechanism === 'path_secret_only') {
    let value = {
      maxBodyBytes: DEFAULT_WEBHOOK_BODY_LIMIT_BYTES,
      duplicateSecurityHeaders: [] as WebhookDuplicateHeaderPolicy[],
      ruleIds: ['path_secret_only']
    };
    return { ...value, specHash: action.specHash, comparable: comparablePolicy(value) };
  }

  let method = d.method.toUpperCase();
  let rules = verification.rules.filter(
    rule =>
      rule.when.methods.includes(method as never) &&
      (!rule.when.registrationStatuses ||
        rule.when.registrationStatuses.includes(d.registrationStatus as never))
  );
  if (rules.length === 0) {
    throw new WebhookCapturePolicyError(
      'routing_projection_unavailable',
      'No stored webhook rule can capture this request'
    );
  }
  let projected = rules.map(rule => {
    let value = {
      maxBodyBytes: rule.maxBodyBytes ?? DEFAULT_WEBHOOK_BODY_LIMIT_BYTES,
      duplicateSecurityHeaders: duplicatePolicyForRule(rule)
    };
    return { ruleId: rule.id, ...value, comparable: comparablePolicy(value) };
  });
  if (new Set(projected.map(policy => policy.comparable)).size !== 1) {
    throw new WebhookCapturePolicyError(
      'routing_projection_unavailable',
      'Candidate webhook rules have ambiguous capture policies'
    );
  }
  return {
    maxBodyBytes: projected[0]!.maxBodyBytes,
    duplicateSecurityHeaders: projected[0]!.duplicateSecurityHeaders,
    ruleIds: projected.map(policy => policy.ruleId).sort(),
    specHash: action.specHash,
    comparable: projected[0]!.comparable
  };
};

export let combineWebhookCapturePolicyProjections = (
  projections: ReturnType<typeof projectStoredWebhookActionCapturePolicy>[]
): WebhookCapturePolicy => {
  if (projections.length === 0) {
    throw new WebhookCapturePolicyError(
      'routing_projection_unavailable',
      'Webhook target has no capture policy'
    );
  }
  let duplicateSecurityHeaders = [
    ...new Map(
      projections
        .flatMap(projection => projection.duplicateSecurityHeaders)
        .map(policy => [`${policy.headerName}:${policy.grammar}`, policy] as const)
    ).values()
  ].sort((first, second) => first.headerName.localeCompare(second.headerName));
  let specHashes = [...new Set(projections.map(projection => projection.specHash))].sort();
  let ruleIds = [...new Set(projections.flatMap(projection => projection.ruleIds))].sort();
  let contract = {
    version: 1 as const,
    // Capture the conservative union once. Each selected trigger still enforces its own
    // body-size and duplicate-header policy during exact verification.
    maxBodyBytes: Math.max(...projections.map(projection => projection.maxBodyBytes)),
    duplicateSecurityHeaders,
    specHashes,
    ruleIds
  };
  return {
    ...contract,
    policyHash: createHash('sha256')
      .update('metorial.webhook-capture-policy\0v1\0')
      .update(canonicalizeJsonJcs(contract))
      .digest('hex')
  };
};

export let resolveWebhookTargetCapturePolicy = async (d: {
  receiverTriggerId?: string;
  receiverId?: string;
  method: string;
}) => {
  let actions: StoredWebhookAction[];
  if (Boolean(d.receiverTriggerId) === Boolean(d.receiverId)) {
    throw new WebhookCapturePolicyError(
      'routing_projection_unavailable',
      'Exactly one webhook target is required'
    );
  }
  if (d.receiverTriggerId) {
    let trigger = await db.slateTriggerReceiverTrigger.findFirst({
      where: {
        id: d.receiverTriggerId,
        source: SlateTriggerReceiverTriggerSource.webhook,
        tombstonedAt: null,
        ingressDisabledAt: null
      },
      select: { registrationStatus: true, action: { select: { spec: true } } }
    });
    actions = trigger
      ? [{ spec: trigger.action.spec, registrationStatus: trigger.registrationStatus }]
      : [];
  } else {
    let receiver = await db.slateTriggerReceiver.findUnique({
      where: { id: d.receiverId },
      select: {
        triggers: {
          where: {
            source: SlateTriggerReceiverTriggerSource.webhook,
            tombstonedAt: null,
            ingressDisabledAt: null
          },
          select: {
            source: true,
            tombstonedAt: true,
            ingressDisabledAt: true,
            registrationStatus: true,
            action: { select: { spec: true } }
          }
        }
      }
    });
    actions =
      receiver?.triggers.filter(isRoutableWebhookReceiverTrigger).map(trigger => ({
        spec: trigger.action.spec,
        registrationStatus: trigger.registrationStatus
      })) ?? [];
  }
  return combineWebhookCapturePolicyProjections(
    actions.map(action =>
      projectStoredWebhookActionCapturePolicy({
        action: action.spec,
        registrationStatus: action.registrationStatus,
        method: d.method
      })
    )
  );
};
