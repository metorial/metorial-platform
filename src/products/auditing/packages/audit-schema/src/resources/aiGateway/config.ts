import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let aiGatewayConfigAuditResource = resource({
  name: 'ai_gateway_config',
  payload: v.typedAny<{
    logRetentionDays: number;
    settings: Record<string, unknown>;
    limits: unknown[];
  }>('ai_gateway_config'),
  presenter: undefined,
  actions: {
    update: true
  }
});
