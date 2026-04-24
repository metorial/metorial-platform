import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumerSessionGetOutput = {
  object: 'consumer.session';
  id: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
};

export let mapConsumerSessionGetOutput = mtMap.object<ConsumerSessionGetOutput>(
  {
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    lastUsedAt: mtMap.objectField('last_used_at', mtMap.date())
  }
);

