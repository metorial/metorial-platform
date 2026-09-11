import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';
import type { SubspaceAuthMethodSummary, SubspaceProviderSummary } from './_shared';

export let providerAuthConfigAuditResource = resource({
  name: 'provider_auth_config',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    source: string;
    name: string | null;
    description: string | null;
    isDefault: boolean;
    isEphemeral: boolean;
    scopes: string[];
    provider: SubspaceProviderSummary;
    authMethod: SubspaceAuthMethodSummary;
    deploymentId: string | null;
    toolFilter: unknown;
    archivedAt: Date | null;
  }>('provider_auth_config'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

/**
 * The OAuth client a tenant registered for a provider. `clientId` and `clientSecret` are
 * both omitted: the secret for obvious reasons, and the id because it is half of a
 * credential pair and says nothing a reviewer cannot get from the provider and scopes.
 */
export let providerAuthCredentialsAuditResource = resource({
  name: 'provider_auth_credentials',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    origin: string;
    name: string | null;
    description: string | null;
    isDefault: boolean;
    isEphemeral: boolean;
    isAutoRegistration: boolean;
    scopes: string[];
    provider: SubspaceProviderSummary;
  }>('provider_auth_credentials'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

/**
 * The hosted flow through which someone connects a provider. `clientSecret` is the
 * bearer for the session and is omitted; the session id is enough to correlate this
 * entry with the auth config the flow produced.
 */
export let providerSetupSessionAuditResource = resource({
  name: 'provider_setup_session',
  payload: v.typedAny<{
    id: string;
    status: string;
    typeSelected: string;
    typeConcrete: string | null;
    uiMode: string;
    name: string | null;
    description: string | null;
    provider: SubspaceProviderSummary | null;
    redirectUrl: string | null;
  }>('provider_setup_session'),
  presenter: undefined,
  actions: {
    create: true,
    update: true
  }
});

/**
 * Auth config material leaving or entering the tenant. These two are the highest-value
 * entries in the whole auth group -- an export is the one operation that takes a
 * credential out of Metorial -- so the originating ip and user agent are recorded on the
 * payload as well as on the audit log row, since the record itself carries them and they
 * are the point of the entry.
 */
export let providerAuthExportAuditResource = resource({
  name: 'provider_auth_export',
  payload: v.typedAny<{
    id: string;
    note: string | null;
    ip: string | null;
    ua: string | null;
    authConfigId: string;
    provider: SubspaceProviderSummary;
  }>('provider_auth_export'),
  presenter: undefined,
  actions: {
    create: true
  }
});

export let providerAuthImportAuditResource = resource({
  name: 'provider_auth_import',
  payload: v.typedAny<{
    id: string;
    note: string | null;
    ip: string | null;
    ua: string | null;
    authConfigId: string;
    provider: SubspaceProviderSummary;
  }>('provider_auth_import'),
  presenter: undefined,
  actions: {
    create: true
  }
});
