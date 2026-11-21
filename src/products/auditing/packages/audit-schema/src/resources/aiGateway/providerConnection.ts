import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let aiGatewayProviderConnectionAuditResource = resource({
  name: 'ai_gateway_provider_connection',
  payload: v.typedAny<{
    id: string;
    name: string;
    providerSlug: string;
    status: string;
    priority: number;
  }>('ai_gateway_provider_connection'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
