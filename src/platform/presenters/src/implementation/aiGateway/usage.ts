import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { aiGatewayUsageTimelineType } from '../../types';

let count = (description: string) => v.number({ description });

export let v1AiGatewayUsageTimelinePresenter = Presenter.create(aiGatewayUsageTimelineType)
  .presenter(async ({ usage }) => ({
    object: 'ai_gateway.usage_timeline' as const,

    interval: usage.interval,
    from: usage.from,
    to: usage.to,

    buckets: usage.buckets.map(bucket => ({
      start: bucket.start,

      requests: bucket.requests,
      succeeded: bucket.succeeded,
      failed: bucket.failed,
      cancelled: bucket.cancelled,
      rejected: bucket.rejected,

      input_tokens: bucket.inputTokens,
      cached_input_tokens: bucket.cachedInputTokens,
      output_tokens: bucket.outputTokens,

      cost_usd: bucket.costUsd,
      metorial_cost_usd: bucket.platformCostUsd,

      average_latency_ms: bucket.averageLatencyMs
    }))
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.usage_timeline', {
        description: "String representing the object's type"
      }),

      interval: v.enumOf(['5m', '15m', '1h', '6h', '1d'], {
        description: 'The width of every bucket'
      }),
      from: v.date({
        description: 'The start of the first bucket. Rounded down to a whole interval.'
      }),
      to: v.date({ description: 'The end of the range, exclusive' }),

      buckets: v.array(
        v.object({
          start: v.date({ description: 'When the bucket starts' }),

          requests: count('All requests'),
          succeeded: count('Requests that succeeded'),
          failed: count('Requests that were refused or broken off by the provider'),
          cancelled: count('Requests the client cancelled'),
          rejected: count(
            'Requests rejected before reaching a provider, e.g. by limits or invalid parameters'
          ),

          input_tokens: count('All input tokens'),
          cached_input_tokens: count('Input tokens read from the prompt cache'),
          output_tokens: count('All output tokens'),

          cost_usd: v.number({
            description:
              'What the requests cost in USD, including model-made routing decisions'
          }),
          metorial_cost_usd: v.number({
            description:
              'The part of cost_usd billed by Metorial, for requests served by the Metorial provider'
          }),

          average_latency_ms: v.nullable(
            v.number({
              description:
                'The average request duration, in ms. Null when there were no requests.'
            })
          )
        }),
        {
          description:
            'Usage per interval, oldest first. Intervals without requests are included with zeros.'
        }
      )
    })
  )
  .build();
