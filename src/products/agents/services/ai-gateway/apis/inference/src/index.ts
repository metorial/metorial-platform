import {
  extractGatewayToken,
  gatewayCredentialService
} from '@mtsrc/ai-gateway-module-access';
import { routeService } from '@mtsrc/ai-gateway-module-routing';
import { createInferenceApp } from './app';

export { createInferenceApp, type InferenceDependencies } from './app';

export let inferenceApp = createInferenceApp({
  authenticate: token => gatewayCredentialService.verify({ token }),
  extractToken: extractGatewayToken,
  route: d => routeService.route(d),
  listModels: async d =>
    (await routeService.listAvailableModels(d)).map(model => ({
      slug: model.slug,
      name: model.name,
      labSlug: model.lab.slug,
      releaseDate: model.releaseDate,
      createdAt: model.createdAt
    }))
});

export let inferenceFetch = inferenceApp.fetch;
