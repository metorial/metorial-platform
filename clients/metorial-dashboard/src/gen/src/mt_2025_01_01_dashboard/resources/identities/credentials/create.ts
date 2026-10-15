import { mapObject } from '@metorial/util-resource-mapper/compact';

export type IdentitiesCredentialsCreateOutput = {
  object: 'identity.credential';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  identityId: string;
  providerId: string;
  deploymentId: string | null;
  configId: string | null;
  authConfigId: string | null;
  delegationConfigId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapIdentitiesCredentialsCreateOutput =
  /* @__PURE__ */ mapObject<IdentitiesCredentialsCreateOutput>(
    [
      'identity_id',
      'provider_id',
      'deployment_id',
      'config_id',
      'auth_config_id',
      'delegation_config_id',
      'created_at',
      'updated_at'
    ],
    1
  );

export type IdentitiesCredentialsCreateBody = {
  identityId: string;
  deploymentId?: string | undefined;
  configId?: string | undefined;
  authConfigId?: string | undefined;
  delegationConfigId?: string | undefined;
};

export let mapIdentitiesCredentialsCreateBody =
  /* @__PURE__ */ mapObject<IdentitiesCredentialsCreateBody>([
    'identity_id',
    'deployment_id',
    'config_id',
    'auth_config_id',
    'delegation_config_id'
  ]);
