import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsConsumerProfilesAssignGroupsOutput = {
  object: 'consumer.profile';
  id: string;
  name: string;
  email: string;
  consumerId: string;
  ssoUserId: string | null;
  createdAt: Date;
};

export let mapManagementInstancePortalsConsumerProfilesAssignGroupsOutput =
  mtMap.object<ManagementInstancePortalsConsumerProfilesAssignGroupsOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    consumerId: mtMap.objectField('consumer_id', mtMap.passthrough()),
    ssoUserId: mtMap.objectField('sso_user_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type ManagementInstancePortalsConsumerProfilesAssignGroupsBody = {
  groupIds: string[];
};

export let mapManagementInstancePortalsConsumerProfilesAssignGroupsBody =
  mtMap.object<ManagementInstancePortalsConsumerProfilesAssignGroupsBody>({
    groupIds: mtMap.objectField('group_ids', mtMap.array(mtMap.passthrough()))
  });

