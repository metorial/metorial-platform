import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import { toAuditConfig } from '../lib/audit';
import type { AiGateway, AiGatewayInput } from '../lib/client';
import type { ScopedInstance } from '../lib/scope';
import { aiGatewayTenantService } from './aiGatewayTenant';

class AiGatewayConfigServiceImpl {
  async get(d: { instance: ScopedInstance }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let [instance, project] = await Promise.all([
      gateway.instance.get(scope),
      gateway.project.get({
        organizationId: scope.organizationId,
        projectId: d.instance.project.id
      })
    ]);

    return { instance, project };
  }

  async update(d: {
    instance: ScopedInstance;
    auditScope: AuditScope;
    input: Pick<
      AiGatewayInput<AiGateway['instance']['upsert']>,
      'logRetentionDays' | 'settings' | 'limits'
    >;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let { instance: previous, project } = await this.get(d);
    let instance = await gateway.instance.upsert({
      organizationId: scope.organizationId,
      projectId: d.instance.project.id,
      ref: d.instance.id,
      name: d.instance.name,
      logRetentionDays: d.input.logRetentionDays,
      settings: d.input.settings,
      limits: d.input.limits
    });

    await Fabric.fire('ai_gateway.config.updated:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      config: toAuditConfig(instance),
      previousConfig: toAuditConfig(previous)
    });

    return { instance, project };
  }
}

export let aiGatewayConfigService = Service.create(
  'aiGatewayConfigService',
  () => new AiGatewayConfigServiceImpl()
).build();
