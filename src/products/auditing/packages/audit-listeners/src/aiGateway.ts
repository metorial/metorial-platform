import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordAiGatewayConfigUpdated = async (
  event: FabricEvents['ai_gateway.config.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'ai_gateway_config', 'update', {
      payload: event.config,
      previousPayload: event.previousConfig,
      recordedAt
    });
  });
};

export let recordAiGatewayTokenCreated = async (
  event: FabricEvents['ai_gateway.token.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'ai_gateway_token', 'create', {
      payload: event.token,
      recordedAt
    });
  });
};

export let recordAiGatewayTokenUpdated = async (
  event: FabricEvents['ai_gateway.token.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'ai_gateway_token', 'update', {
      payload: event.token,
      previousPayload: event.previousToken,
      recordedAt
    });
  });
};

export let recordAiGatewayTokenRevoked = async (
  event: FabricEvents['ai_gateway.token.revoked:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'ai_gateway_token', 'revoke', {
      payload: event.token,
      recordedAt
    });
  });
};

export let recordAiGatewayProviderConnectionCreated = async (
  event: FabricEvents['ai_gateway.provider_connection.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'ai_gateway_provider_connection',
      'create',
      { payload: event.connection, recordedAt }
    );
  });
};

export let recordAiGatewayProviderConnectionUpdated = async (
  event: FabricEvents['ai_gateway.provider_connection.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'ai_gateway_provider_connection',
      'update',
      { payload: event.connection, previousPayload: event.previousConnection, recordedAt }
    );
  });
};

export let recordAiGatewayProviderConnectionArchived = async (
  event: FabricEvents['ai_gateway.provider_connection.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'ai_gateway_provider_connection',
      'delete',
      { payload: event.connection, recordedAt }
    );
  });
};

export let recordAiGatewayVirtualModelCreated = async (
  event: FabricEvents['ai_gateway.virtual_model.created:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'ai_gateway_virtual_model',
      'create',
      {
        payload: event.virtualModel,
        recordedAt
      }
    );
  });
};

export let recordAiGatewayVirtualModelUpdated = async (
  event: FabricEvents['ai_gateway.virtual_model.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'ai_gateway_virtual_model',
      'update',
      {
        payload: event.virtualModel,
        previousPayload: event.previousVirtualModel,
        recordedAt
      }
    );
  });
};

export let recordAiGatewayVirtualModelArchived = async (
  event: FabricEvents['ai_gateway.virtual_model.archived:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'ai_gateway_virtual_model',
      'delete',
      {
        payload: event.virtualModel,
        recordedAt
      }
    );
  });
};

Fabric.listen('ai_gateway.config.updated:after', recordAiGatewayConfigUpdated);
Fabric.listen('ai_gateway.token.created:after', recordAiGatewayTokenCreated);
Fabric.listen('ai_gateway.token.updated:after', recordAiGatewayTokenUpdated);
Fabric.listen('ai_gateway.token.revoked:after', recordAiGatewayTokenRevoked);
Fabric.listen(
  'ai_gateway.provider_connection.created:after',
  recordAiGatewayProviderConnectionCreated
);
Fabric.listen(
  'ai_gateway.provider_connection.updated:after',
  recordAiGatewayProviderConnectionUpdated
);
Fabric.listen(
  'ai_gateway.provider_connection.archived:after',
  recordAiGatewayProviderConnectionArchived
);
Fabric.listen('ai_gateway.virtual_model.created:after', recordAiGatewayVirtualModelCreated);
Fabric.listen('ai_gateway.virtual_model.updated:after', recordAiGatewayVirtualModelUpdated);
Fabric.listen('ai_gateway.virtual_model.archived:after', recordAiGatewayVirtualModelArchived);
