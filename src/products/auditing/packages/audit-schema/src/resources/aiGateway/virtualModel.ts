import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let aiGatewayVirtualModelAuditResource = resource({
  name: 'ai_gateway_virtual_model',
  payload: v.typedAny<{
    id: string;
    slug: string;
    name: string;
    versionId: string | null;
    versionNumber: number | null;
  }>('ai_gateway_virtual_model'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
