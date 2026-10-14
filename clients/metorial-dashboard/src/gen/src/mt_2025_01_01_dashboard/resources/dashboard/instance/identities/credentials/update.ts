import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIdentitiesCredentialsUpdateOutput = {
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

export let mapDashboardInstanceIdentitiesCredentialsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceIdentitiesCredentialsUpdateOutput>(
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

export type DashboardInstanceIdentitiesCredentialsUpdateBody = {
  delegationConfigId: string;
};

export let mapDashboardInstanceIdentitiesCredentialsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceIdentitiesCredentialsUpdateBody>([
    'delegation_config_id'
  ]);
