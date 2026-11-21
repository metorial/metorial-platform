import { v } from '@lowerdeck/validation';
import type { AiGatewayInferenceLog } from '@metorial/module-ai-gateway';
import { Presenter } from '@metorial/presenter';
import { aiGatewayInferenceLogType } from '../../types';

type LogRoute = NonNullable<AiGatewayInferenceLog['route']>;
type LogAttempt = AiGatewayInferenceLog['attempts'][number];
type LogError = NonNullable<LogAttempt['error']>;
type LogVirtualModel = NonNullable<AiGatewayInferenceLog['virtualModel']>;

let presentConnection = (route: LogRoute | LogAttempt) => ({
  provider: route.provider,
  connection_owner: route.connectionOwner,
  connection_id: 'connectionId' in route ? route.connectionId : null,
  vendor_model_id: 'vendorModelId' in route ? route.vendorModelId : null
});

let presentError = (error: LogError) => ({
  code: error.code,
  message: error.message,
  stage: error.stage ?? null,
  param: error.param ?? null,
  http_status: error.httpStatus ?? null,
  provider_code: error.providerCode ?? null
});

let presentVirtualModel = (virtualModel: LogVirtualModel) => ({
  id: virtualModel.id,
  slug: virtualModel.slug,
  version_id: virtualModel.versionId,
  version_number: virtualModel.versionNumber,
  rule_id: virtualModel.ruleId,
  reason: virtualModel.reason,
  trace: virtualModel.trace.map(step => ({
    rule_id: step.ruleId,
    outcome: step.outcome,
    error: step.error ?? null
  })),
  targets: virtualModel.targets,
  skipped_targets: virtualModel.skippedTargets.map(target => ({
    model: target.model,
    reason: target.reason
  })),
  decision: virtualModel.decision
    ? {
        model: virtualModel.decision.model,
        source: virtualModel.decision.source,
        cached: virtualModel.decision.cached,
        latency_ms: virtualModel.decision.latencyMs,
        input_tokens: virtualModel.decision.inputTokens,
        cost_usd: virtualModel.decision.costUsd,
        signals: virtualModel.decision.signals,
        error: virtualModel.decision.error
      }
    : null
});

let connectionFields = {
  provider: v.string({
    description:
      'The provider that served the request, by slug. metorial for the Metorial provider.'
  }),
  connection_owner: v.enumOf(['customer', 'platform'], {
    description:
      "customer for one of your provider connections, platform for Metorial's own provider accounts"
  }),
  connection_id: v.nullable(
    v.string({ description: 'Your provider connection. Null for the Metorial provider.' })
  ),
  vendor_model_id: v.nullable(
    v.string({
      description: "The provider's own model id. Null for the Metorial provider."
    })
  )
};

let errorSchema = v.object(
  {
    code: v.string({ description: 'A machine-readable error code' }),
    message: v.string({ description: 'A human-readable description of the error' }),
    stage: v.nullable(
      v.enumOf(['request', 'limits', 'routing', 'upstream', 'internal'], {
        description:
          'Where the request stopped: request (invalid or unsupported parameters), limits, routing, upstream (refused or broken off by the provider) or internal'
      })
    ),
    param: v.nullable(
      v.string({ description: 'The request parameter that caused the error' })
    ),
    http_status: v.nullable(
      v.number({ description: 'The HTTP status returned for the error' })
    ),
    provider_code: v.nullable(v.string({ description: "The provider's own error code" }))
  },
  { description: 'Why the request did not succeed' }
);

let ms = (description: string) =>
  v.nullable(v.number({ description: `${description}, in ms` }));

let costComponent = (description: string) =>
  v.number({ description: `USD for ${description}` });

export let v1AiGatewayInferenceLogPresenter = Presenter.create(aiGatewayInferenceLogType)
  .presenter(async ({ log }) => ({
    object: 'ai_gateway.inference_log' as const,

    id: log.id,
    token_id: log.tokenId,
    consumer_ref: log.consumerRef,

    dialect: log.dialect,
    operation: log.operation,
    request_id: log.requestId,

    requested_model: log.requestedModel,
    model: log.model
      ? { id: log.model.id ?? null, slug: log.model.slug, lab_slug: log.model.labSlug }
      : null,
    virtual_model: log.virtualModel ? presentVirtualModel(log.virtualModel) : null,
    metadata: log.metadata,
    route: log.route ? presentConnection(log.route) : null,
    attempts: log.attempts.map(attempt => ({
      ...presentConnection(attempt),
      started_at: attempt.startedAt,
      duration_ms: attempt.durationMs,
      outcome: attempt.outcome,
      error: attempt.error ? presentError(attempt.error) : null
    })),

    status: log.status,
    finish_reason: log.finishReason,
    error: log.error ? presentError(log.error) : null,

    usage: log.usage
      ? {
          input: {
            total: log.usage.input.total,
            no_cache: log.usage.input.noCache,
            cache_read: log.usage.input.cacheRead,
            cache_write: log.usage.input.cacheWrite
          },
          output: {
            total: log.usage.output.total,
            text: log.usage.output.text,
            reasoning: log.usage.output.reasoning
          }
        }
      : null,
    cost: log.cost
      ? {
          currency: log.cost.currency,
          priced: log.cost.priced,
          total_usd: log.cost.totalUsd,
          components: {
            input: log.cost.components.input,
            cache_read: log.cost.components.cacheRead,
            cache_write: log.cost.components.cacheWrite,
            output: log.cost.components.output,
            reasoning: log.cost.components.reasoning
          },
          pricing_source: log.cost.pricingSource
        }
      : null,

    timing: {
      received_at: log.timing.receivedAt,
      upstream_started_at: log.timing.upstreamStartedAt ?? null,
      first_token_at: log.timing.firstTokenAt ?? null,
      completed_at: log.timing.completedAt,
      total_ms: log.timing.totalMs,
      upstream_ms: log.timing.upstreamMs ?? null,
      time_to_first_token_ms: log.timing.timeToFirstTokenMs ?? null
    },
    request: {
      message_count: log.request.messageCount ?? null,
      tool_count: log.request.toolCount ?? null,
      max_output_tokens: log.request.maxOutputTokens ?? null,
      user_agent: log.request.userAgent ?? null
    },

    has_content: log.hasContent,
    content: log.content
      ? {
          request: log.content.request as Record<string, unknown>,
          response: (log.content.response ?? null) as Record<string, unknown> | null
        }
      : null,

    expires_at: log.expiresAt,
    created_at: log.timing.receivedAt
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.inference_log', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The inference log's unique identifier" }),
      token_id: v.string({ description: 'The AI gateway token the request was made with' }),
      consumer_ref: v.nullable(
        v.string({ description: "The token's consumer reference at the time of the request" })
      ),

      dialect: v.enumOf(['openai_chat', 'anthropic_messages', 'open_responses'], {
        description: 'The API format the request was made in'
      }),
      operation: v.enumOf(['generate', 'stream', 'embed', 'count_tokens'], {
        description: 'What the request did'
      }),
      request_id: v.nullable(
        v.string({ description: 'The request id sent by the client, if any' })
      ),

      requested_model: v.string({
        description: 'The model or virtual model as given in the request'
      }),
      model: v.nullable(
        v.object(
          {
            id: v.nullable(v.string({ description: "The model's unique identifier" })),
            slug: v.string({ description: "The model's slug" }),
            lab_slug: v.string({ description: 'The lab that makes the model' })
          },
          { description: 'The model that was used. Null if no model was resolved.' }
        )
      ),
      virtual_model: v.nullable(
        v.object(
          {
            id: v.string({ description: "The virtual model's unique identifier" }),
            slug: v.string({ description: "The virtual model's slug" }),
            version_id: v.string({ description: 'The virtual model version that was used' }),
            version_number: v.number({ description: 'The number of that version' }),
            rule_id: v.nullable(
              v.string({ description: 'The rule that matched. Null when no rule matched.' })
            ),
            reason: v.enumOf(['rule', 'default', 'sticky'], {
              description:
                "Why the targets were chosen: a rule matched, the version's defaults applied, or an earlier choice was reused"
            }),
            trace: v.array(
              v.object({
                rule_id: v.string({ description: 'The rule that was evaluated' }),
                outcome: v.string({ description: 'What evaluating the rule resulted in' }),
                error: v.nullable(v.string({ description: 'Why evaluating the rule failed' }))
              }),
              { description: 'Every rule that was evaluated, in order' }
            ),
            targets: v.array(v.string(), {
              description: 'The models the request could be routed to'
            }),
            skipped_targets: v.array(
              v.object({
                model: v.string({ description: 'The model that was skipped' }),
                reason: v.string({ description: 'Why it was skipped' })
              }),
              { description: 'Targets that could not be used' }
            ),
            decision: v.nullable(
              v.object(
                {
                  model: v.string({ description: 'The model that made the decision' }),
                  source: v.nullable(
                    v.enumOf(['customer', 'platform'], {
                      description:
                        'customer if the decision ran over your provider connection, platform for the Metorial provider'
                    })
                  ),
                  cached: v.boolean({ description: 'Whether a cached decision was reused' }),
                  latency_ms: v.number({ description: 'How long the decision took, in ms' }),
                  input_tokens: v.number({ description: 'Input tokens the decision used' }),
                  cost_usd: v.number({ description: 'What the decision cost, in USD' }),
                  signals: v.nullable(
                    v.record(v.any(), { description: 'The signals the decision produced' })
                  ),
                  error: v.nullable(
                    v.object(
                      {
                        code: v.string({ description: 'A machine-readable error code' }),
                        message: v.string({ description: 'A human-readable description' })
                      },
                      { description: 'Why the decision failed' }
                    )
                  )
                },
                { description: 'The model-made routing decision, when a rule asked for one' }
              )
            )
          },
          {
            description: 'How the virtual model routed the request. Null for direct requests.'
          }
        )
      ),
      metadata: v.record(v.string(), { description: 'Metadata sent with the request' }),
      route: v.nullable(
        v.object(connectionFields, {
          description: 'Where the request was served. Null if it never reached a provider.'
        })
      ),
      attempts: v.array(
        v.object({
          ...connectionFields,
          started_at: v.date({ description: 'When the attempt started' }),
          duration_ms: v.number({ description: 'How long the attempt took, in ms' }),
          outcome: v.enumOf(['succeeded', 'failed', 'cancelled'], {
            description: 'How the attempt ended'
          }),
          error: v.nullable(errorSchema)
        }),
        {
          description:
            'Every provider the request was sent to, in order. More than one when fallbacks were used.'
        }
      ),

      status: v.enumOf(['succeeded', 'failed', 'cancelled', 'rejected'], {
        description:
          'How the request ended. rejected requests never reached a provider (invalid parameters, limits or routing); failed ones were refused or broken off by the provider.'
      }),
      finish_reason: v.nullable(
        v.string({ description: 'Why the model stopped generating, as reported by it' })
      ),
      error: v.nullable(errorSchema),

      usage: v.nullable(
        v.object(
          {
            input: v.object(
              {
                total: v.number({ description: 'All input tokens' }),
                no_cache: v.number({ description: 'Input tokens not read from the cache' }),
                cache_read: v.number({
                  description: 'Input tokens read from the prompt cache'
                }),
                cache_write: v.number({
                  description: 'Input tokens written to the prompt cache'
                })
              },
              { description: 'Input token counts' }
            ),
            output: v.object(
              {
                total: v.number({ description: 'All output tokens' }),
                text: v.number({ description: 'Output tokens of generated text' }),
                reasoning: v.number({ description: 'Output tokens used for reasoning' })
              },
              { description: 'Output token counts' }
            )
          },
          { description: 'Token usage. Null if the request never reached a provider.' }
        )
      ),
      cost: v.nullable(
        v.object(
          {
            currency: v.literal('USD', { description: 'The currency of every amount' }),
            priced: v.boolean({
              description:
                'Whether every part of the request could be priced. Parts without a known price count as 0.'
            }),
            total_usd: v.number({ description: 'What the request cost, in USD' }),
            components: v.object(
              {
                input: costComponent('input tokens'),
                cache_read: costComponent('tokens read from the prompt cache'),
                cache_write: costComponent('tokens written to the prompt cache'),
                output: costComponent('output tokens'),
                reasoning: costComponent('reasoning tokens')
              },
              { description: 'The cost broken down by token type' }
            ),
            pricing_source: v.enumOf(['offering', 'connection', 'routing_rule'], {
              description:
                "Where the prices came from: the provider's list price, your connection's pricing override, or the Metorial provider's price"
            })
          },
          {
            description:
              'What the request cost. Null if no cost was recorded, e.g. when it never reached a provider.'
          }
        )
      ),

      timing: v.object(
        {
          received_at: v.date({ description: 'When the gateway received the request' }),
          upstream_started_at: v.nullable(
            v.date({ description: 'When the request was sent to the provider' })
          ),
          first_token_at: v.nullable(
            v.date({ description: 'When the first token was received' })
          ),
          completed_at: v.date({ description: 'When the request completed' }),
          total_ms: v.number({ description: 'How long the whole request took, in ms' }),
          upstream_ms: ms('How long the provider took'),
          time_to_first_token_ms: ms('How long until the first token arrived')
        },
        { description: 'When the request ran and how long it took' }
      ),
      request: v.object(
        {
          message_count: v.nullable(v.number({ description: 'Messages in the request' })),
          tool_count: v.nullable(v.number({ description: 'Tools offered in the request' })),
          max_output_tokens: v.nullable(
            v.number({ description: 'The output token limit set in the request' })
          ),
          user_agent: v.nullable(v.string({ description: "The client's user agent" }))
        },
        { description: 'A summary of the request, without its content' }
      ),

      has_content: v.boolean({
        description:
          'Whether the request and response bodies were stored. They are only stored while content logging is enabled.'
      }),
      content: v.nullable(
        v.object(
          {
            request: v.record(v.any(), {
              description: 'The request body as sent by the client'
            }),
            response: v.nullable(
              v.record(v.any(), { description: 'The response body. Null if there was none.' })
            )
          },
          {
            description:
              'The request and response bodies. Only returned when requested with include_content and still stored.'
          }
        )
      ),

      expires_at: v.date({ description: 'When the log is deleted' }),
      created_at: v.date({ description: 'When the gateway received the request' })
    })
  )
  .build();
