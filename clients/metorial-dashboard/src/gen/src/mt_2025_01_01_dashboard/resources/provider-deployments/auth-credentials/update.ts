import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProviderDeploymentsAuthCredentialsUpdateOutput = {
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

export let mapProviderDeploymentsAuthCredentialsUpdateOutput =
  /* @__PURE__ */ mapObject<ProviderDeploymentsAuthCredentialsUpdateOutput>(
    ['is_default', 'is_managed', 'provider_id', 'created_at', 'updated_at'],
    1
  );

export type ProviderDeploymentsAuthCredentialsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  scopes?: string[] | undefined;
};

export let mapProviderDeploymentsAuthCredentialsUpdateBody =
  /* @__PURE__ */ mapObject<ProviderDeploymentsAuthCredentialsUpdateBody>([
    'client_id',
    'client_secret'
  ]);
