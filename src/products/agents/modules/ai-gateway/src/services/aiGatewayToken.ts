import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import { toAuditToken } from '../lib/audit';
import type { AiGateway, AiGatewayInput, AiGatewayToken } from '../lib/client';
import { createGatewayPaginator } from '../lib/paginator';
import type { ScopedInstance } from '../lib/scope';
import { aiGatewayTenantService } from './aiGatewayTenant';

class AiGatewayTokenServiceImpl {
  list(d: { instance: ScopedInstance; consumerRef?: string }) {
    return createGatewayPaginator(async page => {
      let { gateway, scope } = await aiGatewayTenantService.ensure(d);

      return await gateway.gatewayToken.list({
        ...scope,
        consumerRef: d.consumerRef,
        ...page
      });
    });
  }

  async get(d: { instance: ScopedInstance; gatewayTokenId: string }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let gatewayToken = await gateway.gatewayToken.get({
      organizationId: scope.organizationId,
      gatewayTokenId: d.gatewayTokenId
    });
    if (gatewayToken.instance.ref != d.instance.id) {
      throw new ServiceError(notFoundError('ai_gateway_token', d.gatewayTokenId));
    }

    return gatewayToken;
  }

  async create(d: {
    instance: ScopedInstance;
    auditScope: AuditScope;
    input: AiGatewayInput<AiGateway['gatewayToken']['create']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let gatewayToken = await gateway.gatewayToken.create({ ...d.input, ...scope });

    await Fabric.fire('ai_gateway.token.created:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      token: toAuditToken(gatewayToken)
    });

    return gatewayToken;
  }

  async update(d: {
    instance: ScopedInstance;
    gatewayToken: AiGatewayToken;
    auditScope: AuditScope;
    input: Omit<AiGatewayInput<AiGateway['gatewayToken']['update']>, 'gatewayTokenId'>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let gatewayToken = await gateway.gatewayToken.update({
      ...d.input,
      organizationId: scope.organizationId,
      gatewayTokenId: d.gatewayToken.id
    });

    await Fabric.fire('ai_gateway.token.updated:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      token: toAuditToken(gatewayToken),
      previousToken: toAuditToken(d.gatewayToken)
    });

    return gatewayToken;
  }

  async revoke(d: {
    instance: ScopedInstance;
    gatewayToken: AiGatewayToken;
    auditScope: AuditScope;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let gatewayToken = await gateway.gatewayToken.revoke({
      organizationId: scope.organizationId,
      gatewayTokenId: d.gatewayToken.id
    });

    await Fabric.fire('ai_gateway.token.revoked:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      token: toAuditToken(gatewayToken)
    });

    return gatewayToken;
  }
}

export let aiGatewayTokenService = Service.create(
  'aiGatewayTokenService',
  () => new AiGatewayTokenServiceImpl()
).build();
