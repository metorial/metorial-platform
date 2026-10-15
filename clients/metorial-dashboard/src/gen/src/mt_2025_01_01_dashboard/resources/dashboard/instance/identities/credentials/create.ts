import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIdentitiesCredentialsCreateOutput = {
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

export let mapDashboardInstanceIdentitiesCredentialsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceIdentitiesCredentialsCreateOutput>(
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

export type DashboardInstanceIdentitiesCredentialsCreateBody = {
  identityId: string;
  deploymentId?: string | undefined;
  configId?: string | undefined;
  authConfigId?: string | undefined;
  delegationConfigId?: string | undefined;
};

export let mapDashboardInstanceIdentitiesCredentialsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceIdentitiesCredentialsCreateBody>([
    'identity_id',
    'deployment_id',
    'config_id',
    'auth_config_id',
    'delegation_config_id'
  ]);
