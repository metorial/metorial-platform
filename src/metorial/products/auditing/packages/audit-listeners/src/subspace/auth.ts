import {
  Fabric,
  type AuditSubspaceProviderAuthConfig,
  type AuditSubspaceProviderAuthCredentials,
  type AuditSubspaceProviderSetupSession,
  type FabricEvents
} from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { getSubspaceAuditScope, recordSubspaceAuditEvent } from './_shared';

let authConfigPayload = (authConfig: AuditSubspaceProviderAuthConfig) => ({
  id: authConfig.id,
  status: authConfig.status,
  type: authConfig.type,
  source: authConfig.source,
  name: authConfig.name,
  description: authConfig.description,
  isDefault: authConfig.isDefault,
  isEphemeral: authConfig.isEphemeral,
  scopes: authConfig.scopes,
  provider: { id: authConfig.provider.id, name: authConfig.provider.name },
  authMethod: {
    id: authConfig.authMethod.id,
    key: authConfig.authMethod.key,
    name: authConfig.authMethod.name,
    type: authConfig.authMethod.type
  },
  deploymentId: authConfig.deployment?.id ?? null,
  toolFilter: authConfig.toolFilter,
  archivedAt: authConfig.archivedAt
});

let authCredentialsPayload = (credentials: AuditSubspaceProviderAuthCredentials) => ({
  id: credentials.id,
  status: credentials.status,
  type: credentials.type,
  origin: credentials.origin,
  name: credentials.name,
  description: credentials.description,
  isDefault: credentials.isDefault,
  isEphemeral: credentials.isEphemeral,
  isAutoRegistration: credentials.isAutoRegistration,
  scopes: credentials.scopes,
  provider: { id: credentials.provider.id, name: credentials.provider.name }
});

let setupSessionPayload = (setupSession: AuditSubspaceProviderSetupSession) => ({
  id: setupSession.id,
  status: setupSession.status,
  typeSelected: setupSession.typeSelected,
  typeConcrete: setupSession.typeConcrete,
  uiMode: setupSession.uiMode,
  name: setupSession.name,
  description: setupSession.description,
  provider: setupSession.provider
    ? { id: setupSession.provider.id, name: setupSession.provider.name }
    : null,
  redirectUrl: setupSession.redirectUrl
});

export let recordProviderAuthConfigCreated = async (
  event: FabricEvents['provider.auth_config.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_auth_config', 'create', {
      payload: authConfigPayload(event.authConfig)
    })
  );
};

export let recordProviderAuthConfigUpdated = async (
  event: FabricEvents['provider.auth_config.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_auth_config', 'update', {
      payload: authConfigPayload(event.authConfig),
      previousPayload: authConfigPayload(event.previousAuthConfig)
    })
  );
};

export let recordProviderAuthConfigDeleted = async (
  event: FabricEvents['provider.auth_config.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_auth_config', 'delete', {
      payload: authConfigPayload(event.authConfig)
    })
  );
};

export let recordProviderAuthCredentialsCreated = async (
  event: FabricEvents['provider.auth_credentials.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_auth_credentials', 'create', {
      payload: authCredentialsPayload(event.authCredentials)
    })
  );
};

export let recordProviderAuthCredentialsUpdated = async (
  event: FabricEvents['provider.auth_credentials.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_auth_credentials', 'update', {
      payload: authCredentialsPayload(event.authCredentials),
      previousPayload: authCredentialsPayload(event.previousAuthCredentials)
    })
  );
};

export let recordProviderAuthCredentialsDeleted = async (
  event: FabricEvents['provider.auth_credentials.deleted:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_auth_credentials', 'delete', {
      payload: authCredentialsPayload(event.authCredentials)
    })
  );
};

export let recordProviderSetupSessionCreated = async (
  event: FabricEvents['provider.setup_session.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_setup_session', 'create', {
      payload: setupSessionPayload(event.setupSession)
    })
  );
};

export let recordProviderSetupSessionUpdated = async (
  event: FabricEvents['provider.setup_session.updated:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_setup_session', 'update', {
      payload: setupSessionPayload(event.setupSession),
      previousPayload: setupSessionPayload(event.previousSetupSession)
    })
  );
};

export let recordProviderAuthExportCreated = async (
  event: FabricEvents['provider.auth_export.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_auth_export', 'create', {
      payload: {
        id: event.authExport.id,
        note: event.authExport.note,
        ip: event.authExport.ip,
        ua: event.authExport.ua,
        authConfigId: event.authExport.authConfig.id,
        provider: {
          id: event.authExport.authConfig.provider.id,
          name: event.authExport.authConfig.provider.name
        }
      }
    })
  );
};

export let recordProviderAuthImportCreated = async (
  event: FabricEvents['provider.auth_import.created:after']
) => {
  let scope = getSubspaceAuditScope(event);
  if (!scope) return;

  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(scope, 'provider_auth_import', 'create', {
      payload: {
        id: event.authImport.id,
        note: event.authImport.note,
        ip: event.authImport.ip,
        ua: event.authImport.ua,
        authConfigId: event.authImport.authConfig.id,
        provider: {
          id: event.authImport.authConfig.provider.id,
          name: event.authImport.authConfig.provider.name
        }
      }
    })
  );
};

Fabric.listen('provider.auth_config.created:after', recordProviderAuthConfigCreated);
Fabric.listen('provider.auth_config.updated:after', recordProviderAuthConfigUpdated);
Fabric.listen('provider.auth_config.deleted:after', recordProviderAuthConfigDeleted);

export let recordManagedProviderAuthCredentialsCreated = async (
  event: FabricEvents['provider.auth_credentials.managed_created:after']
) => {
  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(event.auditScope, 'provider_auth_credentials', 'create', {
      payload: authCredentialsPayload(event.authCredentials)
    })
  );
};

export let recordManagedProviderAuthCredentialsUpdated = async (
  event: FabricEvents['provider.auth_credentials.managed_updated:after']
) => {
  await recordSubspaceAuditEvent(() =>
    auditTrackerService.recordEvent(event.auditScope, 'provider_auth_credentials', 'update', {
      payload: authCredentialsPayload(event.authCredentials),
      previousPayload: authCredentialsPayload(event.previousAuthCredentials)
    })
  );
};

Fabric.listen('provider.auth_credentials.created:after', recordProviderAuthCredentialsCreated);
Fabric.listen(
  'provider.auth_credentials.managed_created:after',
  recordManagedProviderAuthCredentialsCreated
);
Fabric.listen(
  'provider.auth_credentials.managed_updated:after',
  recordManagedProviderAuthCredentialsUpdated
);
Fabric.listen('provider.auth_credentials.updated:after', recordProviderAuthCredentialsUpdated);
Fabric.listen('provider.auth_credentials.deleted:after', recordProviderAuthCredentialsDeleted);

Fabric.listen('provider.setup_session.created:after', recordProviderSetupSessionCreated);
Fabric.listen('provider.setup_session.updated:after', recordProviderSetupSessionUpdated);

Fabric.listen('provider.auth_export.created:after', recordProviderAuthExportCreated);
Fabric.listen('provider.auth_import.created:after', recordProviderAuthImportCreated);
