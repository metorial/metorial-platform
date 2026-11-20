import {
  extractGatewayToken,
  gatewayCredentialService
} from '@mtsrc/ai-gateway-module-access';
import { isModelAllowed, routeService } from '@mtsrc/ai-gateway-module-routing';
import {
  getInstanceVirtualModels,
  virtualModelRoutingService
} from '@mtsrc/ai-gateway-module-virtual-models';
import { createInferenceApp } from './app';
import type { ListedModel } from './lib/models';

export { createInferenceApp, type InferenceDependencies } from './app';

let virtualModelOwner = 'virtual';

export let inferenceApp = createInferenceApp({
  authenticate: token => gatewayCredentialService.verify({ token }),
  extractToken: extractGatewayToken,
  route: d => virtualModelRoutingService.route(d),
  listModels: async d => {
    let [catalogModels, virtualModels] = await Promise.all([
      routeService.listAvailableModels(d),
      getInstanceVirtualModels({ instanceId: d.principal.instance.id })
    ]);

    let listed: ListedModel[] = [
      ...virtualModels
        .filter(virtualModel =>
          isModelAllowed({
            allowedModels: d.principal.token.allowedModels,
            requested: virtualModel.slug,
            modelSlug: virtualModel.slug
          })
        )
        .map(virtualModel => ({
          slug: virtualModel.slug,
          name: virtualModel.name,
          labSlug: virtualModelOwner,
          releaseDate: null,
          createdAt: virtualModel.createdAt
        })),
      ...catalogModels.map(model => ({
        slug: model.slug,
        name: model.name,
        labSlug: model.lab.slug,
        releaseDate: model.releaseDate,
        createdAt: model.createdAt
      }))
    ];

    return listed;
  }
});

export let inferenceFetch = inferenceApp.fetch;
