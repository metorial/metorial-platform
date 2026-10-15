import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput = {
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

export let mapDashboardInstanceProviderDeploymentsAuthCredentialsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsAuthCredentialsGetOutput>(
    ['is_default', 'is_managed', 'provider_id', 'created_at', 'updated_at'],
    1
  );
