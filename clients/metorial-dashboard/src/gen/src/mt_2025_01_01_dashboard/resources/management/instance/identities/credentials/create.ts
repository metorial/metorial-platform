import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceIdentitiesCredentialsCreateOutput = {
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

export let mapManagementInstanceIdentitiesCredentialsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceIdentitiesCredentialsCreateOutput>(
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

export type ManagementInstanceIdentitiesCredentialsCreateBody = {
  identityId: string;
  deploymentId?: string | undefined;
  configId?: string | undefined;
  authConfigId?: string | undefined;
  delegationConfigId?: string | undefined;
};

export let mapManagementInstanceIdentitiesCredentialsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceIdentitiesCredentialsCreateBody>([
    'identity_id',
    'deployment_id',
    'config_id',
    'auth_config_id',
    'delegation_config_id'
  ]);
