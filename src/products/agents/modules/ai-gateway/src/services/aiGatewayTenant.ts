import { Service } from '@lowerdeck/service';
import { requireAiGateway } from '../lib/client';
import { upsertInstanceScope, type ScopedInstance } from '../lib/scope';

class AiGatewayTenantServiceImpl {
  async ensure(d: { instance: ScopedInstance }) {
    let gateway = requireAiGateway();

    let gatewayInstanceId =
      d.instance.aiGatewayInstanceId ??
      (
        await upsertInstanceScope({
          gateway,
          organization: d.instance.organization,
          project: d.instance.project,
          instance: d.instance
        })
      ).instance.id;

    return {
      gateway,
      gatewayInstanceId,
      scope: { organizationId: d.instance.organization.id, instanceId: d.instance.id }
    };
  }
}

export let aiGatewayTenantService = Service.create(
  'aiGatewayTenantService',
  () => new AiGatewayTenantServiceImpl()
).build();
