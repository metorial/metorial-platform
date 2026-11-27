import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { aiGatewayConfigType } from '../../types';
import { aiGatewayLimitsSchema, presentAiGatewayLimit } from './_shared';

let restrictionSchema = (description: string) =>
  v.nullable(
    v.object(
      {
        reason: v.nullable(v.string({ description: 'Why the restriction applies' })),
        since: v.date({ description: 'When the restriction started' })
      },
      { description }
    )
  );

export let v1AiGatewayConfigPresenter = Presenter.create(aiGatewayConfigType)
  .presenter(async ({ config: { instance, project } }) => ({
    object: 'ai_gateway.config' as const,

    log_retention_days: instance.logRetentionDays,
    settings: {
      content_logging: {
        enabled: instance.settings.contentLogging.enabled,
        retention_days: instance.settings.contentLogging.retentionDays
      },
      metorial_provider: { enabled: instance.settings.metorialProviderEnabled },
      fallbacks: { enabled: instance.settings.fallbacksEnabled },
      zero_data_retention: { required: instance.settings.zdrRequired }
    },
    limits: instance.limits.map(presentAiGatewayLimit),

    plan_limits: project.platformLimits.map(limit => ({
      metric: limit.metric,
      amount: limit.amount,
      interval_seconds: limit.intervalSeconds
    })),
    disabled: project.disabled
      ? { reason: project.disabled.reason, since: project.disabled.since }
      : null,
    billing_restriction: project.billingRestriction
      ? { reason: project.billingRestriction.reason, since: project.billingRestriction.since }
      : null,

    updated_at: instance.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.config', {
        description: "String representing the object's type"
      }),

      log_retention_days: v.number({
        description:
          'How many days inference logs (metadata, usage and cost, without content) are kept. Usage timelines are built from these logs, so they reach back no further.'
      }),
      settings: v.object(
        {
          content_logging: v.object(
            {
              enabled: v.boolean({
                description:
                  'Whether request and response bodies are stored with inference logs'
              }),
              retention_days: v.number({
                description: 'How many days stored request and response bodies are kept'
              })
            },
            {
              description:
                'Storing prompts and responses. Inference logs only return content when this was enabled at the time of the request.'
            }
          ),
          metorial_provider: v.object(
            {
              enabled: v.boolean({
                description:
                  "Whether requests can be served with Metorial's own provider accounts, billed by Metorial. Your own provider connections are always tried first."
              })
            },
            { description: 'The Metorial provider' }
          ),
          fallbacks: v.object(
            {
              enabled: v.boolean({
                description:
                  'Whether a failed request is retried with the next provider that serves the model. When disabled, only the first candidate is tried.'
              })
            },
            { description: 'Provider fallbacks' }
          ),
          zero_data_retention: v.object(
            {
              required: v.boolean({
                description:
                  'Whether requests are only routed to providers that do not retain prompts or responses. Models without such a provider become unavailable.'
              })
            },
            { description: 'Zero data retention' }
          )
        },
        { description: 'Settings for every request made through the AI gateway' }
      ),
      limits: aiGatewayLimitsSchema,

      plan_limits: v.array(
        v.object({
          metric: v.enumOf(['requests', 'tokens', 'metorial_spend_usd'], {
            description:
              'What the limit counts. metorial_spend_usd only counts what Metorial bills, not traffic over your own provider connections.'
          }),
          amount: v.number({ description: 'The most that can be used per interval' }),
          interval_seconds: v.number({ description: 'The window the amount applies to' })
        }),
        {
          description:
            "Limits from your Metorial plan. They apply to all of the project's instances combined."
        }
      ),
      disabled: restrictionSchema(
        'Set when the AI gateway is disabled for the project, e.g. because it is not on your plan. Every request is rejected.'
      ),
      billing_restriction: restrictionSchema(
        'Set when the Metorial provider is unavailable because of billing, e.g. when you are out of credits. Requests over your own provider connections still work.'
      ),

      updated_at: v.date({ description: 'When the configuration was last changed' })
    })
  )
  .build();
