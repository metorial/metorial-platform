import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let aiGatewayTokenAuditResource = resource({
  name: 'ai_gateway_token',
  payload: v.typedAny<{
    id: string;
    name: string;
    consumerRef: string | null;
    allowedModels: string[];
    expiresAt: Date | null;
    revokedAt: Date | null;
  }>('ai_gateway_token'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    revoke: true
  }
});
