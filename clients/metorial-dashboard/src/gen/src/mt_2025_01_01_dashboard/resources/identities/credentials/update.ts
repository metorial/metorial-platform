import { mapObject } from '@metorial/util-resource-mapper/compact';

export type IdentitiesCredentialsUpdateOutput = {
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

export let mapIdentitiesCredentialsUpdateOutput =
  /* @__PURE__ */ mapObject<IdentitiesCredentialsUpdateOutput>(
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

export type IdentitiesCredentialsUpdateBody = { delegationConfigId: string };

export let mapIdentitiesCredentialsUpdateBody =
  /* @__PURE__ */ mapObject<IdentitiesCredentialsUpdateBody>([
    'delegation_config_id'
  ]);
