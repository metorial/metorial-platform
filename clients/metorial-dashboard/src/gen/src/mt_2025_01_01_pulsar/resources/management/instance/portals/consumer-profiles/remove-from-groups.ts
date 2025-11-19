import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsConsumerProfilesRemoveFromGroupsOutput = {
  object: 'consumer.profile';
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  consumerId: string;
  ssoUserId: string | null;
  createdAt: Date;
};

export let mapManagementInstancePortalsConsumerProfilesRemoveFromGroupsOutput =
  mtMap.object<ManagementInstancePortalsConsumerProfilesRemoveFromGroupsOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      email: mtMap.objectField('email', mtMap.passthrough()),
      imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
      consumerId: mtMap.objectField('consumer_id', mtMap.passthrough()),
      ssoUserId: mtMap.objectField('sso_user_id', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date())
    }
  );

export type ManagementInstancePortalsConsumerProfilesRemoveFromGroupsBody = {
  groupIds: string[];
};

export let mapManagementInstancePortalsConsumerProfilesRemoveFromGroupsBody =
  mtMap.object<ManagementInstancePortalsConsumerProfilesRemoveFromGroupsBody>({
    groupIds: mtMap.objectField('group_ids', mtMap.array(mtMap.passthrough()))
  });

