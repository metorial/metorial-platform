import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup } from '../../../middleware/instanceGroup';

export let aiGatewayReadScopes = ['instance.ai_gateway:read'] as const;
export let aiGatewayWriteScopes = ['instance.ai_gateway:write'] as const;
export let aiGatewayInferenceLogReadScopes = [
  'instance.ai_gateway.inference_log:read'
] as const;

export let aiGatewayInstanceGroup = instanceGroup.use(
  hasFlags(['ai-gateway-enabled', 'paid-ai-gateway'])
);
