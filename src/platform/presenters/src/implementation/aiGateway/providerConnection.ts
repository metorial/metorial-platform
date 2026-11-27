import { v } from '@lowerdeck/validation';
import type { AiGatewayProviderConnection } from '@metorial/module-ai-gateway';
import { Presenter } from '@metorial/presenter';
import { aiGatewayProviderConnectionType } from '../../types';
import { aiGatewayPricingSchema, presentAiGatewayPricing } from './_shared';

type PricingOverride = NonNullable<AiGatewayProviderConnection['pricingOverride']>;

let presentPricingOverride = (override: PricingOverride) => ({
  multiplier: override.multiplier ?? null,
  models: Object.fromEntries(
    Object.entries(override.models ?? {}).map(([modelSlug, pricing]) => [
      modelSlug,
      presentAiGatewayPricing(pricing)
    ])
  )
});

export let v1AiGatewayProviderConnectionPresenter = Presenter.create(
  aiGatewayProviderConnectionType
)
  .presenter(async ({ connection }) => ({
    object: 'ai_gateway.provider_connection' as const,

    id: connection.id,
    name: connection.name,
    description: connection.description,
    priority: connection.priority,

    provider: {
      id: connection.provider.id,
      slug: connection.provider.slug,
      name: connection.provider.name
    },

    config: connection.config,
    features: {
      zdr: connection.features.zdr ?? false
    },
    pricing_override: connection.pricingOverride
      ? presentPricingOverride(connection.pricingOverride)
      : null,
    credential_hint: connection.credentialHint,

    status: connection.status,
    status_message: connection.statusMessage,
    consecutive_failures: connection.consecutiveFailures,

    last_checked_at: connection.lastCheckedAt,
    last_valid_at: connection.lastValidAt,
    next_check_at: connection.nextCheckAt,
    deleted_at: connection.archivedAt,
    created_at: connection.createdAt,
    updated_at: connection.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.provider_connection', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The provider connection's unique identifier" }),
      name: v.string({ description: "The connection's name" }),
      description: v.nullable(v.string({ description: "The connection's description" })),
      priority: v.number({
        description:
          'Connections with a higher priority are tried first when several connections can serve a request. Defaults to 0.'
      }),

      provider: v.object(
        {
          id: v.string({ description: "The provider's unique identifier" }),
          slug: v.string({ description: "The provider's slug, e.g. openai or anthropic" }),
          name: v.string({ description: "The provider's display name" })
        },
        { description: 'The provider the connection sends requests to' }
      ),

      config: v.record(v.union([v.string(), v.number(), v.boolean()]), {
        description:
          'Provider-specific settings that are not secret, e.g. the resource name of an Azure deployment'
      }),
      features: v.object(
        {
          zdr: v.boolean({
            description:
              'Whether the provider account does not retain prompts or completions. Requests that require zero data retention only route to connections with it enabled.'
          })
        },
        { description: 'Capabilities of the provider account behind the connection' }
      ),
      pricing_override: v.nullable(
        v.object(
          {
            multiplier: v.nullable(
              v.number({
                description:
                  'Factor applied to the catalog price of every model without its own price below, e.g. 0.8 for a 20% discount'
              })
            ),
            models: v.record(aiGatewayPricingSchema, {
              description:
                'Prices that replace the catalog price of a model, keyed by model slug'
            })
          },
          {
            description:
              'Prices you pay this provider when they differ from the catalog, e.g. because of a negotiated discount. Used to calculate the cost of requests routed through the connection. Null to use catalog prices.'
          }
        )
      ),
      credential_hint: v.nullable(
        v.string({
          description:
            'The last characters of the credentials, to recognize them by. The credentials themselves are never returned.'
        })
      ),

      status: v.enumOf(['pending', 'valid', 'invalid', 'disabled'], {
        description:
          'Whether the gateway can use the connection. valid: the provider accepted the credentials at the last check. pending: the credentials have not been confirmed yet, e.g. because the provider could not be reached; the connection is still used for routing, after valid ones. invalid: the provider rejected the credentials; routing skips the connection, and it is re-checked daily for a week before it waits for new credentials. disabled: you turned the connection off; it is neither routed to nor checked.'
      }),
      status_message: v.nullable(
        v.string({
          description:
            'Why the last check failed, e.g. the error the provider returned. Null after a successful check.'
        })
      ),
      consecutive_failures: v.number({
        description:
          'How many checks in a row have failed, either because the provider rejected the credentials or could not be reached. Reset by a successful check.'
      }),

      last_checked_at: v.nullable(
        v.date({ description: 'When the credentials were last checked with the provider' })
      ),
      last_valid_at: v.nullable(
        v.date({ description: 'When the provider last accepted the credentials' })
      ),
      next_check_at: v.nullable(
        v.date({
          description:
            'When the credentials are checked next. Null when no check is scheduled, e.g. for disabled or deleted connections.'
        })
      ),
      deleted_at: v.nullable(v.date({ description: 'When the connection was deleted' })),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
