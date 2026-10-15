import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput = {
  object: 'provider.auth_credentials';
  id: string;
  type: 'oauth';
  status: 'active' | 'archived' | 'deleted';
  isDefault: boolean;
  isManaged: boolean;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  scopes: string[] | null;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsAuthCredentialsUpdateOutput>(
    ['is_default', 'is_managed', 'provider_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  scopes?: string[] | undefined;
};

export let mapDashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsAuthCredentialsUpdateBody>(
    ['client_id', 'client_secret']
  );
