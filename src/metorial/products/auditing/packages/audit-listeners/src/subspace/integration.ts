import {
  Fabric,
  type AuditSubspaceIntegration,
  type AuditSubspaceIntegrationInstance,
  type AuditSubspaceIntegrationInstanceGroup,
  type AuditSubspaceIntegrationInstanceProvider,
  type AuditSubspaceIntegrationProvider,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let integrationPayload = (integration: AuditSubspaceIntegration) => ({
  id: integration.id,
  status: integration.status,
  slug: integration.slug,
  name: integration.name,
  description: integration.description,
  isMagicMcpBacking: integration.isMagicMcpBacking,
  canAttachCustomToolFilters: integration.canAttachCustomToolFilters,
  canAttachCustomProviderConfig: integration.canAttachCustomProviderConfig,
  canOverrideToolFilters: integration.canOverrideToolFilters,
  currentVersionId: integration.currentVersion?.id ?? null,
  currentVersionIndex: integration.currentVersionIndex,
  archivedAt: integration.archivedAt
});

let integrationInstancePayload = (integrationInstance: AuditSubspaceIntegrationInstance) => ({
  id: integrationInstance.id,
  status: integrationInstance.status,
  name: integrationInstance.name,
  description: integrationInstance.description,
  isMagicMcpBacking: integrationInstance.isMagicMcpBacking,
  integration: {
    id: integrationInstance.integration.id,
    name: integrationInstance.integration.name
  },
  identityId: integrationInstance.identity?.id ?? null,
  identityActorId: integrationInstance.identityActor?.id ?? null,
  archivedAt: integrationInstance.archivedAt
});

export let recordIntegrationCreated = async (
  event: FabricEvents['provider.integration.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration', 'create', {
      payload: integrationPayload(event.integration)
    })
  );
};

export let recordIntegrationUpdated = async (
  event: FabricEvents['provider.integration.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration', 'update', {
      payload: integrationPayload(event.integration),
      previousPayload: integrationPayload(event.previousIntegration)
    })
  );
};

export let recordIntegrationDeleted = async (
  event: FabricEvents['provider.integration.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration', 'delete', {
      payload: integrationPayload(event.integration)
    })
  );
};

export let recordIntegrationInstanceCreated = async (
  event: FabricEvents['provider.integration_instance.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance', 'create', {
      payload: integrationInstancePayload(event.integrationInstance)
    })
  );
};

export let recordIntegrationInstanceUpdated = async (
  event: FabricEvents['provider.integration_instance.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance', 'update', {
      payload: integrationInstancePayload(event.integrationInstance),
      previousPayload: integrationInstancePayload(event.previousIntegrationInstance)
    })
  );
};

export let recordIntegrationInstanceDeleted = async (
  event: FabricEvents['provider.integration_instance.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance', 'delete', {
      payload: integrationInstancePayload(event.integrationInstance)
    })
  );
};

Fabric.listen('provider.integration.created:after', recordIntegrationCreated);
Fabric.listen('provider.integration.updated:after', recordIntegrationUpdated);
Fabric.listen('provider.integration.deleted:after', recordIntegrationDeleted);

Fabric.listen('provider.integration_instance.created:after', recordIntegrationInstanceCreated);
Fabric.listen('provider.integration_instance.updated:after', recordIntegrationInstanceUpdated);
Fabric.listen('provider.integration_instance.deleted:after', recordIntegrationInstanceDeleted);

let integrationProviderPayload = (integrationProvider: AuditSubspaceIntegrationProvider) => ({
  id: integrationProvider.id,
  status: integrationProvider.status,
  integration: {
    id: integrationProvider.integration.id,
    name: integrationProvider.integration.name
  },
  provider: {
    id: integrationProvider.provider.id,
    name: integrationProvider.provider.name
  },
  currentVersionId: integrationProvider.currentVersion?.id ?? null
});

let instanceGroupPayload = (group: AuditSubspaceIntegrationInstanceGroup) => ({
  id: group.id,
  status: group.status,
  name: group.name,
  description: group.description,
  isMagicMcpBacking: group.isMagicMcpBacking ?? false,
  identityId: group.identity?.id ?? null,
  identityActorId: group.identityActor?.id ?? null,
  archivedAt: group.archivedAt
});

let boundProviderBase = (bound: AuditSubspaceIntegrationInstanceProvider) => ({
  id: bound.id,
  status: bound.status,
  integrationId: bound.integration?.id ?? null,
  integrationProviderId: bound.integrationProvider?.id ?? null,
  provider: bound.integrationProvider
    ? {
        id: bound.integrationProvider.provider.id,
        name: bound.integrationProvider.provider.name
      }
    : null
});

let instanceProviderPayload = (bound: AuditSubspaceIntegrationInstanceProvider) => ({
  ...boundProviderBase(bound),
  integrationInstanceId: bound.integrationInstance?.id ?? null
});

let groupProviderPayload = (bound: AuditSubspaceIntegrationInstanceProvider) => ({
  ...boundProviderBase(bound),
  integrationInstanceGroupId: bound.integrationInstanceGroup?.id ?? null
});

export let recordIntegrationProviderCreated = async (
  event: FabricEvents['provider.integration_provider.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_provider', 'create', {
      payload: integrationProviderPayload(event.integrationProvider)
    })
  );
};

export let recordIntegrationProviderUpdated = async (
  event: FabricEvents['provider.integration_provider.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_provider', 'update', {
      payload: integrationProviderPayload(event.integrationProvider),
      previousPayload: integrationProviderPayload(event.previousIntegrationProvider)
    })
  );
};

export let recordIntegrationProviderDeleted = async (
  event: FabricEvents['provider.integration_provider.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_provider', 'delete', {
      payload: integrationProviderPayload(event.integrationProvider)
    })
  );
};

export let recordIntegrationInstanceGroupCreated = async (
  event: FabricEvents['provider.integration_instance_group.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance_group', 'create', {
      payload: instanceGroupPayload(event.integrationInstanceGroup)
    })
  );
};

export let recordIntegrationInstanceGroupUpdated = async (
  event: FabricEvents['provider.integration_instance_group.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance_group', 'update', {
      payload: instanceGroupPayload(event.integrationInstanceGroup),
      previousPayload: instanceGroupPayload(event.previousIntegrationInstanceGroup)
    })
  );
};

export let recordIntegrationInstanceGroupDeleted = async (
  event: FabricEvents['provider.integration_instance_group.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance_group', 'delete', {
      payload: instanceGroupPayload(event.integrationInstanceGroup)
    })
  );
};

export let recordIntegrationInstanceProviderSet = async (
  event: FabricEvents['provider.integration_instance_provider.set:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance_provider', 'set', {
      payload: instanceProviderPayload(event.integrationInstanceProvider)
    })
  );
};

export let recordIntegrationInstanceGroupProviderSet = async (
  event: FabricEvents['provider.integration_instance_group_provider.set:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance_group_provider', 'set', {
      payload: groupProviderPayload(event.integrationInstanceGroupProvider)
    })
  );
};

export let recordIntegrationInstanceGroupProviderDeleted = async (
  event: FabricEvents['provider.integration_instance_group_provider.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_instance_group_provider', 'delete', {
      payload: groupProviderPayload(event.integrationInstanceGroupProvider)
    })
  );
};

export let recordIntegrationSetupSessionCreated = async (
  event: FabricEvents['provider.integration_setup_session.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'integration_setup_session', 'create', {
      payload: {
        id: event.setupSession.id,
        status: event.setupSession.status,
        integration: event.setupSession.integration
          ? {
              id: event.setupSession.integration.id,
              name: event.setupSession.integration.name
            }
          : null
      }
    })
  );
};

Fabric.listen('provider.integration_provider.created:after', recordIntegrationProviderCreated);
Fabric.listen('provider.integration_provider.updated:after', recordIntegrationProviderUpdated);
Fabric.listen('provider.integration_provider.deleted:after', recordIntegrationProviderDeleted);

Fabric.listen(
  'provider.integration_instance_group.created:after',
  recordIntegrationInstanceGroupCreated
);
Fabric.listen(
  'provider.integration_instance_group.updated:after',
  recordIntegrationInstanceGroupUpdated
);
Fabric.listen(
  'provider.integration_instance_group.deleted:after',
  recordIntegrationInstanceGroupDeleted
);

Fabric.listen(
  'provider.integration_instance_provider.set:after',
  recordIntegrationInstanceProviderSet
);
Fabric.listen(
  'provider.integration_instance_group_provider.set:after',
  recordIntegrationInstanceGroupProviderSet
);
Fabric.listen(
  'provider.integration_instance_group_provider.deleted:after',
  recordIntegrationInstanceGroupProviderDeleted
);

Fabric.listen(
  'provider.integration_setup_session.created:after',
  recordIntegrationSetupSessionCreated
);
