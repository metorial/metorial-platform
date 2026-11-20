import { metorialProviderSlug } from '@mtsrc/ai-gateway-spec';
import type {
  InferenceAttempt,
  InferenceContentDocument,
  InferenceLogDocument
} from '@mtsrc/ai-gateway-store';

// Which provider and key serve the metorial provider is never shown to tenants.
let presentRoute = (route: NonNullable<InferenceLogDocument['route']>) =>
  route.connectionOwner == 'platform'
    ? { provider: metorialProviderSlug, connectionOwner: route.connectionOwner }
    : {
        provider: route.providerSlug,
        connectionOwner: route.connectionOwner,
        connectionId: route.connectionId,
        vendorModelId: route.vendorModelId
      };

let presentAttempt = (attempt: InferenceAttempt) => ({
  ...(attempt.connectionOwner == 'platform'
    ? { provider: metorialProviderSlug, connectionOwner: attempt.connectionOwner }
    : {
        provider: attempt.providerSlug,
        connectionOwner: attempt.connectionOwner,
        connectionId: attempt.connectionId,
        vendorModelId: attempt.vendorModelId
      }),
  startedAt: attempt.startedAt,
  durationMs: attempt.durationMs,
  outcome: attempt.outcome,
  error: attempt.error ?? null
});

export let inferenceLogPresenter = (
  log: InferenceLogDocument,
  content?: InferenceContentDocument | null
) => ({
  object: 'ai_gateway#inference_log',

  id: log._id,
  organizationId: log.organizationId,
  projectId: log.projectId,
  instanceId: log.instanceId,
  tokenId: log.tokenId,
  consumerRef: log.consumerRef ?? null,

  dialect: log.dialect,
  operation: log.operation,
  requestId: log.requestId ?? null,

  requestedModel: log.requestedModel,
  model: log.model ?? null,
  virtualModel: log.virtualModel ?? null,
  metadata: log.metadata ?? {},
  route: log.route ? presentRoute(log.route) : null,
  attempts: log.attempts.map(presentAttempt),

  status: log.status,
  finishReason: log.finishReason ?? null,
  error: log.error ?? null,

  usage: log.usage ?? null,
  cost: log.billedCost ?? null,

  timing: log.timing,
  request: log.request,

  hasContent: log.hasContent,
  content:
    content === undefined
      ? undefined
      : content
        ? { request: content.request, response: content.response ?? null }
        : null,

  expiresAt: log.expiresAt
});
