import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumersUpdateOutput = {
  object: 'consumer';
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapConsumersUpdateOutput = mtMap.object<ConsumersUpdateOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  email: mtMap.objectField('email', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

export type ConsumersUpdateBody = {
  name?: string | undefined;
  email?: string | undefined;
};

export let mapConsumersUpdateBody = mtMap.object<ConsumersUpdateBody>({
  name: mtMap.objectField('name', mtMap.passthrough()),
  email: mtMap.objectField('email', mtMap.passthrough())
});

