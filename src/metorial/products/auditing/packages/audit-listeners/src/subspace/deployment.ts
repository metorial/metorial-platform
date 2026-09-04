import {
  Fabric,
  type AuditSubspaceProviderConfig,
  type AuditSubspaceProviderConfigVault,
  type AuditSubspaceProviderDeployment,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let deploymentPayload = (deployment: AuditSubspaceProviderDeployment) => ({
  id: deployment.id,
  status: deployment.status,
  name: deployment.name,
  description: deployment.description,
  isDefault: deployment.isDefault,
  isEphemeral: deployment.isEphemeral,
  provider: { id: deployment.provider.id, name: deployment.provider.name },
  toolFilter: deployment.toolFilter,
  archivedAt: deployment.archivedAt
});

let configPayload = (config: AuditSubspaceProviderConfig) => ({
  id: config.id,
  status: config.status,
  name: config.name,
  description: config.description,
  isDefault: config.isDefault,
  isEphemeral: config.isEphemeral,
  isForVault: config.isForVault,
  provider: { id: config.provider.id, name: config.provider.name },
  deploymentId: config.deployment?.id ?? null,
  toolFilter: config.toolFilter,
  archivedAt: config.archivedAt
});

let configVaultPayload = (configVault: AuditSubspaceProviderConfigVault) => ({
  id: configVault.id,
  status: configVault.status,
  name: configVault.name,
  description: configVault.description,
  archivedAt: configVault.archivedAt
});

export let recordProviderDeploymentCreated = async (
  event: FabricEvents['provider.deployment.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_deployment', 'create', {
      payload: deploymentPayload(event.deployment)
    })
  );
};

export let recordProviderDeploymentUpdated = async (
  event: FabricEvents['provider.deployment.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_deployment', 'update', {
      payload: deploymentPayload(event.deployment),
      previousPayload: deploymentPayload(event.previousDeployment)
    })
  );
};

export let recordProviderDeploymentDeleted = async (
  event: FabricEvents['provider.deployment.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_deployment', 'delete', {
      payload: deploymentPayload(event.deployment)
    })
  );
};

export let recordProviderConfigCreated = async (
  event: FabricEvents['provider.config.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_config', 'create', {
      payload: configPayload(event.config)
    })
  );
};

export let recordProviderConfigUpdated = async (
  event: FabricEvents['provider.config.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_config', 'update', {
      payload: configPayload(event.config),
      previousPayload: configPayload(event.previousConfig)
    })
  );
};

export let recordProviderConfigDeleted = async (
  event: FabricEvents['provider.config.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_config', 'delete', {
      payload: configPayload(event.config)
    })
  );
};

export let recordProviderConfigVaultCreated = async (
  event: FabricEvents['provider.config_vault.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_config_vault', 'create', {
      payload: configVaultPayload(event.configVault)
    })
  );
};

export let recordProviderConfigVaultUpdated = async (
  event: FabricEvents['provider.config_vault.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_config_vault', 'update', {
      payload: configVaultPayload(event.configVault),
      previousPayload: configVaultPayload(event.previousConfigVault)
    })
  );
};

export let recordProviderConfigVaultDeleted = async (
  event: FabricEvents['provider.config_vault.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_config_vault', 'delete', {
      payload: configVaultPayload(event.configVault)
    })
  );
};

Fabric.listen('provider.deployment.created:after', recordProviderDeploymentCreated);
Fabric.listen('provider.deployment.updated:after', recordProviderDeploymentUpdated);
Fabric.listen('provider.deployment.deleted:after', recordProviderDeploymentDeleted);

Fabric.listen('provider.config.created:after', recordProviderConfigCreated);
Fabric.listen('provider.config.updated:after', recordProviderConfigUpdated);
Fabric.listen('provider.config.deleted:after', recordProviderConfigDeleted);

Fabric.listen('provider.config_vault.created:after', recordProviderConfigVaultCreated);
Fabric.listen('provider.config_vault.updated:after', recordProviderConfigVaultUpdated);
Fabric.listen('provider.config_vault.deleted:after', recordProviderConfigVaultDeleted);
