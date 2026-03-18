import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceIdentitiesCredentialsGetOutput = {
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

export let mapDashboardInstanceIdentitiesCredentialsGetOutput =
  mtMap.object<DashboardInstanceIdentitiesCredentialsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    identityId: mtMap.objectField('identity_id', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    deploymentId: mtMap.objectField('deployment_id', mtMap.passthrough()),
    configId: mtMap.objectField('config_id', mtMap.passthrough()),
    authConfigId: mtMap.objectField('auth_config_id', mtMap.passthrough()),
    delegationConfigId: mtMap.objectField(
      'delegation_config_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

