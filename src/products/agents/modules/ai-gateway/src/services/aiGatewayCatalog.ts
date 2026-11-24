import { Service } from '@lowerdeck/service';
import { requireAiGateway } from '../lib/client';
import { createGatewayPaginator } from '../lib/paginator';

class AiGatewayCatalogServiceImpl {
  listLabs() {
    return createGatewayPaginator(page => requireAiGateway().catalog.listLabs(page));
  }

  listProviders() {
    return createGatewayPaginator(page => requireAiGateway().catalog.listProviders(page));
  }

  listModels(d: { labSlug?: string; kind?: string; search?: string }) {
    return createGatewayPaginator(page =>
      requireAiGateway().catalog.listModels({ ...d, ...page })
    );
  }

  async getModel(d: { modelId: string }) {
    return await requireAiGateway().catalog.getModel({ modelId: d.modelId });
  }

  listOfferings(d: { modelId?: string; providerSlug?: string }) {
    return createGatewayPaginator(page =>
      requireAiGateway().catalog.listOfferings({ ...d, ...page })
    );
  }

  async resolveModel(d: { model: string }) {
    return await requireAiGateway().catalog.resolveModel({ model: d.model });
  }
}

export let aiGatewayCatalogService = Service.create(
  'aiGatewayCatalogService',
  () => new AiGatewayCatalogServiceImpl()
).build();
