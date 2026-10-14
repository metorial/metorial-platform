import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsAuthCredentialsCreateOutput = {
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

export let mapManagementInstanceProviderDeploymentsAuthCredentialsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsAuthCredentialsCreateOutput>(
    ['is_default', 'is_managed', 'provider_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceProviderDeploymentsAuthCredentialsCreateBody = {
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

export let mapManagementInstanceProviderDeploymentsAuthCredentialsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsAuthCredentialsCreateBody>(
    ['provider_id', ['config', 0, [1, ['client_id', 'client_secret']]]]
  );
