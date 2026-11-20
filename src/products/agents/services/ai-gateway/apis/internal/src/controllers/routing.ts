import { v } from '@lowerdeck/validation';
import { routeService } from '@mtsrc/ai-gateway-module-routing';
import {
  providerFeatureSlugs,
  resolveInstanceSettings,
  type GatewayPrincipal
} from '@mtsrc/ai-gateway-spec';
import { previewCandidate } from '../presenters/route';
import { app, instanceApp } from './_app';

// Lets operators see how a model name would route for an instance without sending a request.
// Token restrictions are not applied: the preview answers "what can this instance reach".
export let routingController = app.controller({
  preview: instanceApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        instanceId: v.string(),
        model: v.string({ modifiers: [v.minLength(1)] }),
        requiredFeatures: v.optional(v.array(v.enumOf(providerFeatureSlugs)))
      })
    )
    .do(async ctx => {
      let principal: GatewayPrincipal = {
        token: {
          id: 'preview',
          consumerRef: null,
          allowedModels: [],
          limits: {},
          metadata: {}
        },
        organization: { id: ctx.organization.id, ref: ctx.organization.ref },
        project: { id: ctx.instance.project.id, ref: ctx.instance.project.ref },
        instance: {
          id: ctx.instance.id,
          ref: ctx.instance.ref,
          logRetentionDays: ctx.instance.logRetentionDays,
          settings: resolveInstanceSettings(ctx.instance.settings)
        }
      };

      let route = await routeService.route({
        principal,
        model: ctx.input.model,
        requiredFeatures: ctx.input.requiredFeatures
      });

      return {
        object: 'ai_gateway#route_preview',
        requested: ctx.input.model,
        request: route.request,
        via: route.via,
        model: route.model,
        candidates: route.candidates.map(previewCandidate)
      };
    })
});
