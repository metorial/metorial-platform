import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { aiGatewayTokenType } from '../../types';
import {
  aiGatewayConsumerSchema,
  aiGatewayLimitsSchema,
  presentAiGatewayConsumer,
  presentAiGatewayLimit
} from './_shared';

export let v1AiGatewayTokenPresenter = Presenter.create(aiGatewayTokenType)
  .presenter(async ({ gatewayToken, consumer, secret }) => ({
    object: 'ai_gateway.token' as const,

    id: gatewayToken.id,
    name: gatewayToken.name,
    prefix: gatewayToken.prefix,
    secret: secret ?? null,
    consumer: presentAiGatewayConsumer(consumer),

    allowed_models: gatewayToken.allowedModels,
    limits: gatewayToken.limits.map(presentAiGatewayLimit),
    metadata: gatewayToken.metadata,

    last_used_at: gatewayToken.lastUsedAt,
    expires_at: gatewayToken.expiresAt,
    revoked_at: gatewayToken.revokedAt,
    created_at: gatewayToken.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.token', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The token's unique identifier" }),
      name: v.string({ description: "The token's name" }),
      prefix: v.string({
        description: 'The first characters of the secret, to recognize the token by'
      }),
      secret: v.nullable(
        v.string({
          description:
            'The secret to send as the API key of AI gateway requests. Only returned when the token is created.'
        })
      ),
      consumer: aiGatewayConsumerSchema(
        'The consumer the token was created for. Inference logs and usage can be filtered by it. Null if the token has no consumer or the consumer no longer exists.'
      ),

      allowed_models: v.array(v.string(), {
        description:
          'Models and virtual models the token can call. An empty list allows every model.'
      }),
      limits: aiGatewayLimitsSchema,
      metadata: v.record(v.string(), {
        description:
          'User-defined metadata. Virtual model rules can read it as token.metadata.'
      }),

      last_used_at: v.nullable(v.date({ description: 'When the token last made a request' })),
      expires_at: v.nullable(
        v.date({ description: 'When the token stops working. Null if it never expires.' })
      ),
      revoked_at: v.nullable(v.date({ description: 'When the token was revoked' })),
      created_at: v.date()
    })
  )
  .build();
