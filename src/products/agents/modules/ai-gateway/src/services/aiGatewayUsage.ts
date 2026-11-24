import { Service } from '@lowerdeck/service';
import type { AiGateway, AiGatewayInput } from '../lib/client';
import type { ScopedInstance } from '../lib/scope';
import { aiGatewayTenantService } from './aiGatewayTenant';

class AiGatewayUsageServiceImpl {
  async timeline(d: {
    instance: ScopedInstance;
    input: AiGatewayInput<AiGateway['inferenceLog']['usageTimeline']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.inferenceLog.usageTimeline({ ...d.input, ...scope });
  }
}

export let aiGatewayUsageService = Service.create(
  'aiGatewayUsageService',
  () => new AiGatewayUsageServiceImpl()
).build();
