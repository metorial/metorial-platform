import { resourceSet } from '../../_lib/resource';
import { aiGatewayConfigAuditResource } from './config';
import { aiGatewayProviderConnectionAuditResource } from './providerConnection';
import { aiGatewayTokenAuditResource } from './token';
import { aiGatewayVirtualModelAuditResource } from './virtualModel';

export let aiGatewayResources = resourceSet({
  ai_gateway_config: aiGatewayConfigAuditResource,
  ai_gateway_token: aiGatewayTokenAuditResource,
  ai_gateway_provider_connection: aiGatewayProviderConnectionAuditResource,
  ai_gateway_virtual_model: aiGatewayVirtualModelAuditResource
});
