import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput = {
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

export let mapDashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsAuthCredentialsCreateOutput>(
    ['is_default', 'is_managed', 'provider_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody = {
  providerId: string;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  config: {
    type?: 'oauth' | undefined;
    clientId: string;
    clientSecret: string;
    scopes: string[];
  };
};

export let mapDashboardInstanceProviderDeploymentsAuthCredentialsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsAuthCredentialsCreateBody>(
    ['provider_id', ['config', 0, [1, ['client_id', 'client_secret']]]]
  );
