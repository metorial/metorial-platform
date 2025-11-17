import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumerProfileGetOutput = {
  object: 'consumer.profile';
  id: string;
  name: string;
  email: string;
  consumerId: string;
  ssoUserId: string | null;
  createdAt: Date;
};

export let mapConsumerProfileGetOutput = mtMap.object<ConsumerProfileGetOutput>(
  {
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    consumerId: mtMap.objectField('consumer_id', mtMap.passthrough()),
    ssoUserId: mtMap.objectField('sso_user_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  }
);

