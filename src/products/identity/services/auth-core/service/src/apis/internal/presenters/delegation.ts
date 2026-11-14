import { env } from '../../../env';
import { ssoDelegationService } from '../../../services/sso/delegation';
import { ssoConnectionPresenter, ssoTenantPresenter } from './sso';

export let exportedDelegationPresenter = (delegation: any) => ({
  object: 'ares#ssoDelegation' as const,
  direction: 'exported' as const,
  id: delegation.id,
  identifier: delegation.identifier,
  tenantId: delegation.tenant.id,
  clientId: delegation.clientId,
  status: 'active' as const,
  instance: {
    id: delegation.instance.id,
    authorizationUrl: ssoDelegationService.getAuthorizationUrl({
      clientId: delegation.clientId
    }),
    tokenUrl: `${env.service.ARES_SSO_URL}/metorial-ares/sso-delegation/token`
  },
  tenant: ssoTenantPresenter(delegation.tenant),
  connections: (delegation.tenant.connections ?? []).map(ssoConnectionPresenter),
  createdAt: delegation.createdAt,
  updatedAt: delegation.updatedAt
});

export let importedDelegationPresenter = (delegation: any) => ({
  object: 'ares#ssoDelegation' as const,
  direction: 'imported' as const,
  id: delegation.id,
  sourceDelegationId: delegation.sourceDelegationId,
  sourceTenantId: delegation.sourceTenantId,
  sourceExternalId: delegation.sourceExternalId,
  tenantId: delegation.tenant?.id ?? null,
  clientId: delegation.clientId,
  status: delegation.status,
  instance: {
    id: delegation.remoteInstance.remoteId,
    authorizationUrl: ssoDelegationService.getAuthorizationUrl({
      clientId: delegation.clientId,
      endpoint: delegation.remoteInstance.authorizationEndpointUrl
    }),
    tokenUrl: delegation.remoteInstance.tokenUrl
  },
  localExportedDelegationId: delegation.localExportedDelegation?.id ?? null,
  tenant: delegation.tenant ? ssoTenantPresenter(delegation.tenant) : null,
  connections: (delegation.connections ?? []).map(ssoConnectionPresenter),
  sync: {
    lastAttemptAt: delegation.lastSyncAttemptAt,
    lastSyncedAt: delegation.lastSyncedAt,
    failureCount: delegation.syncFailureCount,
    lastError: delegation.lastSyncError,
    disabledAt: delegation.disabledAt
  },
  createdAt: delegation.createdAt,
  updatedAt: delegation.updatedAt
});

export let delegationPresenter = (item: any) =>
  item.direction === 'exported'
    ? exportedDelegationPresenter(item.delegation)
    : importedDelegationPresenter(item.delegation);
