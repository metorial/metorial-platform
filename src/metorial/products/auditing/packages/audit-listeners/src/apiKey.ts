import { bindAuditScope } from '@metorial/audit-scope';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let apiKeyPayload = (apiKey: {
  id: string;
  status: string;
  type: string;
  name: string;
  description: string | null;
  ipFilters: string[] | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
  kind?: string | null;
}) => ({
  id: apiKey.id,
  status: apiKey.status,
  type: apiKey.type,
  name: apiKey.name,
  description: apiKey.description,
  ipFilters: apiKey.ipFilters,
  expiresAt: apiKey.expiresAt,
  deletedAt: apiKey.deletedAt
});

let getApiKeyAuditScope = (
  event:
    | FabricEvents['machine_access.api_key.created:after']
    | FabricEvents['machine_access.api_key.updated:after']
    | FabricEvents['machine_access.api_key.revoked:after']
    | FabricEvents['machine_access.api_key.rotated:after']
    | FabricEvents['machine_access.api_key.expired:after']
    | FabricEvents['machine_access.api_key:revealed']
) => {
  if (!event.auditScope) return null;
  if (event.apiKey.kind == 'system_internal') return null;

  return bindAuditScope({
    scope: event.auditScope,
    organization: event.organization,
    instance: event.machineAccess.instanceOid
      ? { oid: event.machineAccess.instanceOid }
      : null
  });
};

export let recordApiKeyCreated = async (
  event: FabricEvents['machine_access.api_key.created:after']
) => {
  let auditScope = getApiKeyAuditScope(event);
  if (!auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'api_key', 'create', {
      payload: apiKeyPayload(event.apiKey),
      recordedAt
    });
  });
};

export let recordApiKeyUpdated = async (
  event: FabricEvents['machine_access.api_key.updated:after']
) => {
  let auditScope = getApiKeyAuditScope(event);
  if (!auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'api_key', 'update', {
      payload: apiKeyPayload(event.apiKey),
      previousPayload: apiKeyPayload(event.previousApiKey),
      recordedAt
    });
  });
};

export let recordApiKeyRevoked = async (
  event: FabricEvents['machine_access.api_key.revoked:after']
) => {
  let auditScope = getApiKeyAuditScope(event);
  if (!auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'api_key', 'delete', {
      payload: apiKeyPayload(event.apiKey),
      previousPayload: apiKeyPayload(event.previousApiKey),
      recordedAt
    });
  });
};

export let recordApiKeyRotated = async (
  event: FabricEvents['machine_access.api_key.rotated:after']
) => {
  let auditScope = getApiKeyAuditScope(event);
  if (!auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'api_key', 'rotate', {
      payload: apiKeyPayload(event.apiKey),
      previousPayload: apiKeyPayload(event.previousApiKey),
      recordedAt
    });
  });
};

export let recordApiKeyExpired = async (
  event: FabricEvents['machine_access.api_key.expired:after']
) => {
  let auditScope = getApiKeyAuditScope(event);
  if (!auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'api_key', 'expire', {
      payload: apiKeyPayload(event.apiKey),
      previousPayload: apiKeyPayload(event.previousApiKey),
      recordedAt
    });
  });
};

export let recordApiKeyRevealed = async (
  event: FabricEvents['machine_access.api_key:revealed']
) => {
  let auditScope = getApiKeyAuditScope(event);
  if (!auditScope) return;

  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(auditScope, 'api_key', 'reveal', {
      payload: apiKeyPayload(event.apiKey),
      recordedAt
    });
  });
};

Fabric.listen('machine_access.api_key.created:after', recordApiKeyCreated);
Fabric.listen('machine_access.api_key.updated:after', recordApiKeyUpdated);
Fabric.listen('machine_access.api_key.revoked:after', recordApiKeyRevoked);
Fabric.listen('machine_access.api_key.rotated:after', recordApiKeyRotated);
Fabric.listen('machine_access.api_key.expired:after', recordApiKeyExpired);
Fabric.listen('machine_access.api_key:revealed', recordApiKeyRevealed);
