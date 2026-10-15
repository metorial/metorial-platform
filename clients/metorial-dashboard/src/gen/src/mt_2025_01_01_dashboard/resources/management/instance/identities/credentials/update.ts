import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceIdentitiesCredentialsUpdateOutput = {
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

export let mapManagementInstanceIdentitiesCredentialsUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceIdentitiesCredentialsUpdateOutput>(
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

export type ManagementInstanceIdentitiesCredentialsUpdateBody = {
  delegationConfigId: string;
};

export let mapManagementInstanceIdentitiesCredentialsUpdateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceIdentitiesCredentialsUpdateBody>([
    'delegation_config_id'
  ]);
