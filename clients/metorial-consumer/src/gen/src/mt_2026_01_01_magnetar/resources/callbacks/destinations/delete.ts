import { mtMap } from '@metorial/util-resource-mapper';

export type CallbacksDestinationsDeleteOutput = {
  object: 'callback.destination';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  url: string;
  method: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapCallbacksDestinationsDeleteOutput =
  mtMap.object<CallbacksDestinationsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    method: mtMap.objectField('method', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

