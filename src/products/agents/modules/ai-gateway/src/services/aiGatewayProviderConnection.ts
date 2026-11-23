import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import { toAuditProviderConnection } from '../lib/audit';
import type { AiGateway, AiGatewayInput, AiGatewayProviderConnection } from '../lib/client';
import { createGatewayPaginator } from '../lib/paginator';
import type { ScopedInstance } from '../lib/scope';
import { aiGatewayTenantService } from './aiGatewayTenant';

type ConnectionStatus = AiGatewayProviderConnection['status'];

class AiGatewayProviderConnectionServiceImpl {
  list(d: { instance: ScopedInstance; providerSlug?: string; statuses?: ConnectionStatus[] }) {
    return createGatewayPaginator(async page => {
      let { gateway, scope } = await aiGatewayTenantService.ensure(d);

      return await gateway.providerConnection.list({
        ...scope,
        providerSlug: d.providerSlug,
        status: d.statuses,
        ...page
      });
    });
  }

  async get(d: { instance: ScopedInstance; connectionId: string }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.providerConnection.get({ ...scope, connectionId: d.connectionId });
  }

  async create(d: {
    instance: ScopedInstance;
    auditScope: AuditScope;
    input: AiGatewayInput<AiGateway['providerConnection']['create']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let connection = await gateway.providerConnection.create({ ...d.input, ...scope });

    await Fabric.fire('ai_gateway.provider_connection.created:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      connection: toAuditProviderConnection(connection)
    });

    return connection;
  }

  async update(d: {
    instance: ScopedInstance;
    connection: AiGatewayProviderConnection;
    auditScope: AuditScope;
    input: Omit<AiGatewayInput<AiGateway['providerConnection']['update']>, 'connectionId'>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let connection = await gateway.providerConnection.update({
      ...d.input,
      ...scope,
      connectionId: d.connection.id
    });

    await this.fireUpdated({ ...d, updated: connection });

    return connection;
  }

  async check(d: { instance: ScopedInstance; connection: AiGatewayProviderConnection }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.providerConnection.check({ ...scope, connectionId: d.connection.id });
  }

  async setEnabled(d: {
    instance: ScopedInstance;
    connection: AiGatewayProviderConnection;
    auditScope: AuditScope;
    enabled: boolean;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let connection = await gateway.providerConnection.setEnabled({
      ...scope,
      connectionId: d.connection.id,
      enabled: d.enabled
    });

    await this.fireUpdated({ ...d, updated: connection });

    return connection;
  }

  async archive(d: {
    instance: ScopedInstance;
    connection: AiGatewayProviderConnection;
    auditScope: AuditScope;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let connection = await gateway.providerConnection.archive({
      ...scope,
      connectionId: d.connection.id
    });

    await Fabric.fire('ai_gateway.provider_connection.archived:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      connection: toAuditProviderConnection(connection)
    });

    return connection;
  }

  private async fireUpdated(d: {
    instance: ScopedInstance;
    connection: AiGatewayProviderConnection;
    updated: AiGatewayProviderConnection;
    auditScope: AuditScope;
  }) {
    await Fabric.fire('ai_gateway.provider_connection.updated:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      connection: toAuditProviderConnection(d.updated),
      previousConnection: toAuditProviderConnection(d.connection)
    });
  }
}

export let aiGatewayProviderConnectionService = Service.create(
  'aiGatewayProviderConnectionService',
  () => new AiGatewayProviderConnectionServiceImpl()
).build();
