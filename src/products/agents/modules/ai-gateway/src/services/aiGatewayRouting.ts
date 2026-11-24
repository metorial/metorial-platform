import { Service } from '@lowerdeck/service';
import type { AiGateway, AiGatewayInput } from '../lib/client';
import type { ScopedInstance } from '../lib/scope';
import { aiGatewayTenantService } from './aiGatewayTenant';

class AiGatewayRoutingServiceImpl {
  async preview(d: {
    instance: ScopedInstance;
    input: AiGatewayInput<AiGateway['routing']['preview']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.routing.preview({ ...d.input, ...scope });
  }
}

export let aiGatewayRoutingService = Service.create(
  'aiGatewayRoutingService',
  () => new AiGatewayRoutingServiceImpl()
).build();
