import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAiGatewayInferenceLogsGetOutput = {
  object: 'ai_gateway.inference_log';
  id: string;
  tokenId: string;
  consumerRef: string | null;
  dialect: 'openai_chat' | 'anthropic_messages' | 'open_responses';
  operation: 'generate' | 'stream' | 'embed' | 'count_tokens';
  requestId: string | null;
  requestedModel: string;
  model: { id: string | null; slug: string; labSlug: string } | null;
  virtualModel: {
    id: string;
    slug: string;
    versionId: string;
    versionNumber: number;
    ruleId: string | null;
    reason: 'rule' | 'default' | 'sticky';
    trace: { ruleId: string; outcome: string; error: string | null }[];
    targets: string[];
    skippedTargets: { model: string; reason: string }[];
    decision: {
      model: string;
      source: 'customer' | 'platform' | null;
      cached: boolean;
      latencyMs: number;
      inputTokens: number;
      costUsd: number;
      signals: Record<string, any> | null;
      error: { code: string; message: string } | null;
    } | null;
  } | null;
  metadata: Record<string, string>;
  route: {
    provider: string;
    connectionOwner: 'customer' | 'platform';
    connectionId: string | null;
    vendorModelId: string | null;
  } | null;
  attempts: {
    provider: string;
    connectionOwner: 'customer' | 'platform';
    connectionId: string | null;
    vendorModelId: string | null;
    startedAt: Date;
    durationMs: number;
    outcome: 'succeeded' | 'failed' | 'cancelled';
    error: {
      code: string;
      message: string;
      stage: 'request' | 'limits' | 'routing' | 'upstream' | 'internal' | null;
      param: string | null;
      httpStatus: number | null;
      providerCode: string | null;
    } | null;
  }[];
  status: 'succeeded' | 'failed' | 'cancelled' | 'rejected';
  finishReason: string | null;
  error: {
    code: string;
    message: string;
    stage: 'request' | 'limits' | 'routing' | 'upstream' | 'internal' | null;
    param: string | null;
    httpStatus: number | null;
    providerCode: string | null;
  } | null;
  usage: {
    input: {
      total: number;
      noCache: number;
      cacheRead: number;
      cacheWrite: number;
    };
    output: { total: number; text: number; reasoning: number };
  } | null;
  cost: {
    currency: 'USD';
    priced: boolean;
    totalUsd: number;
    components: {
      input: number;
      cacheRead: number;
      cacheWrite: number;
      output: number;
      reasoning: number;
    };
    pricingSource: 'offering' | 'connection' | 'routing_rule';
  } | null;
  timing: {
    receivedAt: Date;
    upstreamStartedAt: Date | null;
    firstTokenAt: Date | null;
    completedAt: Date;
    totalMs: number;
    upstreamMs: number | null;
    timeToFirstTokenMs: number | null;
  };
  request: {
    messageCount: number | null;
    toolCount: number | null;
    maxOutputTokens: number | null;
    userAgent: string | null;
  };
  hasContent: boolean;
  content: {
    request: Record<string, any>;
    response: Record<string, any> | null;
  } | null;
  expiresAt: Date;
  createdAt: Date;
};

export let mapDashboardInstanceAiGatewayInferenceLogsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAiGatewayInferenceLogsGetOutput>(
    [
      'token_id',
      'consumer_ref',
      'request_id',
      'requested_model',
      ['model', 0, [1, ['lab_slug']]],
      [
        'virtual_model',
        1,
        [
          1,
          [
            'version_id',
            'version_number',
            'rule_id',
            ['trace', 0, [2, [1, ['rule_id']]]],
            'skipped_targets',
            ['decision', 0, [1, ['latency_ms', 'input_tokens', 'cost_usd']]]
          ]
        ]
      ],
      [
        'route',
        0,
        [1, ['connection_owner', 'connection_id', 'vendor_model_id']]
      ],
      [
        'attempts',
        0,
        [
          2,
          [
            1,
            [
              'connection_owner',
              'connection_id',
              'vendor_model_id',
              'started_at',
              'duration_ms',
              ['error', 0, [1, ['http_status', 'provider_code']]]
            ]
          ]
        ]
      ],
      'finish_reason',
      ['error', 0, [1, ['http_status', 'provider_code']]],
      [
        'usage',
        0,
        [1, [['input', 0, [1, ['no_cache', 'cache_read', 'cache_write']]]]]
      ],
      [
        'cost',
        0,
        [
          1,
          [
            'total_usd',
            ['components', 0, [1, ['cache_read', 'cache_write']]],
            'pricing_source'
          ]
        ]
      ],
      [
        'timing',
        0,
        [
          1,
          [
            'received_at',
            'upstream_started_at',
            'first_token_at',
            'completed_at',
            'total_ms',
            'upstream_ms',
            'time_to_first_token_ms'
          ]
        ]
      ],
      [
        'request',
        0,
        [1, ['message_count', 'tool_count', 'max_output_tokens', 'user_agent']]
      ],
      'has_content',
      'expires_at',
      'created_at'
    ],
    1
  );

export type DashboardInstanceAiGatewayInferenceLogsGetQuery = {
  includeContent?: boolean | undefined;
};

export let mapDashboardInstanceAiGatewayInferenceLogsGetQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAiGatewayInferenceLogsGetQuery>([
    'include_content'
  ]);
