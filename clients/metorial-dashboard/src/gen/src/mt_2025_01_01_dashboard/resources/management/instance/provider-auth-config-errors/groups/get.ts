import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderAuthConfigErrorsGroupsGetOutput = {
  object: 'provider.auth_config_error_group';
  id: string;
  type: string;
  code: string;
  message: string;
  providerId: string;
  occurrenceCount: number;
  createdAt: Date;
};

export let mapManagementInstanceProviderAuthConfigErrorsGroupsGetOutput =
  mtMap.object<ManagementInstanceProviderAuthConfigErrorsGroupsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    code: mtMap.objectField('code', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    occurrenceCount: mtMap.objectField('occurrence_count', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

