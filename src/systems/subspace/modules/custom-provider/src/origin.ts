import { delay } from '@lowerdeck/delay';
import { createOriginClient } from '@metorial-platform-systems/origin-client';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let origin: ReturnType<typeof createOriginClient> = createOriginClient({
  endpoint: env.origin.ORIGIN_URL
});

(async () => {
  while (true) {
    console.log('Attempting to connect to Origin...');
    try {
      await origin.tenant.upsert({
        identifier: 'subspace-test',
        name: 'Subspace TEST'
      });
      console.log('Successfully connected to Origin');
      return;
    } catch (error) {
      console.error('Failed to connect to Origin, retrying in 5 seconds...', error);
    }

    await delay(5000);
  }
})();

export let getTenantForOrigin = async (tenant: Tenant) => {
  if (!tenant.originTenantId) {
    let originTenant = await origin.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: {
        originTenantId: originTenant.id,
        originTenantIdentifier: originTenant.identifier
      }
    });
  }

  return {
    id: tenant.originTenantId!,
    identifier: tenant.originTenantIdentifier!
  };
};

export type OriginList<T> = {
  object: 'list';
  items: T[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
};

export type ScmProviderName = 'github' | 'gitlab';
export type ScmProviderType =
  | 'github'
  | 'github_enterprise'
  | 'gitlab'
  | 'gitlab_selfhosted';
export type ScmSetupSessionStatus = 'completed' | 'expired' | 'pending';

export type ScmConnection = {
  object: 'origin#scm_installation';
  id: string;
  provider: ScmProviderName;
  externalInstallationId: string | null;
  accountType: 'user' | 'organization' | null;
  externalAccountId: string;
  externalAccountLogin: string;
  externalAccountName: string | null;
  externalAccountEmail: string | null;
  externalAccountImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ScmProvider = {
  object: 'origin#scmBackend';
  id: string;
  type: ScmProviderType;
  name: string;
  description: string | null;
  apiUrl: string;
  webUrl: string;
  appSlug: string | null;
  isDefault: boolean;
  hasCredentials: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ScmProviderSetupSession = {
  object: 'origin#scmBackendSetupSession';
  id: string;
  type: ScmProviderType;
  url: string;
  parentInstallationSessionId: string | null;
  status: ScmSetupSessionStatus;
  backend: ScmProvider | null;
  createdAt: Date;
  expiresAt: Date;
};

export type ScmConnectionSetupSession = {
  id: string;
  url: string;
  status: ScmSetupSessionStatus;
  installation: ScmConnection | null;
  createdAt: Date;
  expiresAt: Date;
};

export type ScmAccountPreview = {
  object: 'origin#scm_account_preview';
  provider: ScmProviderName;
  externalId: string;
  name: string;
  identifier: string;
};

export type ScmRepositoryPreview = {
  object: 'origin#scm_account_preview';
  provider: ScmProviderName;
  externalId: string;
  name: string;
  identifier: string;
  createdAt: Date;
  updatedAt: Date;
  lastPushedAt: Date | null;
  account: {
    externalId: string;
    name: string;
    identifier: string;
    provider: ScmProviderName;
  };
};
