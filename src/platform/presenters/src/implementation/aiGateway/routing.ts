import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { aiGatewayRoutePreviewType } from '../../types';
import {
  aiGatewayModelRequestSchema,
  aiGatewayModelViaSchema,
  aiGatewayRouteCandidateSchema,
  presentAiGatewayModelRequest,
  presentAiGatewayRouteCandidate
} from './_shared';

export let v1AiGatewayRoutePreviewPresenter = Presenter.create(aiGatewayRoutePreviewType)
  .presenter(async ({ preview }) => ({
    object: 'ai_gateway.route_preview' as const,

    requested: preview.requested,
    request: presentAiGatewayModelRequest(preview.request),
    via: preview.via,
    model: { slug: preview.model.slug, lab_slug: preview.model.labSlug },

    candidates: preview.candidates.map(presentAiGatewayRouteCandidate)
  }))
  .schema(
    v.object({
      object: v.literal('ai_gateway.route_preview', {
        description: "String representing the object's type"
      }),

      requested: v.string({ description: 'The model string the preview was made for' }),
      request: aiGatewayModelRequestSchema,
      via: aiGatewayModelViaSchema,
      model: v.object(
        {
          slug: v.string({ description: "The model's slug, e.g. anthropic/claude-sonnet-4" }),
          lab_slug: v.string({ description: 'The slug of the lab that makes the model' })
        },
        { description: 'The catalog model the requested string resolved to' }
      ),

      candidates: v.array(aiGatewayRouteCandidateSchema({}), {
        description:
          'The providers a request would be sent to, in the order they are tried. The gateway moves on to the next one when a provider fails. Your provider connections come first, then the Metorial provider if it is enabled for the instance. When several Metorial routes share traffic, their order is drawn at random for each request.'
      })
    })
  )
  .build();
