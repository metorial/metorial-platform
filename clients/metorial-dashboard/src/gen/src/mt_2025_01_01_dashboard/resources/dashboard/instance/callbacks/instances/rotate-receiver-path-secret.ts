import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput =
  {
    object: 'callback.receiver_path_secret';
    id: string;
    generation: number;
    value: string;
    webhookUrl?: string | undefined;
  };

export let mapDashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput =
  mtMap.object<DashboardInstanceCallbacksInstancesRotateReceiverPathSecretOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      generation: mtMap.objectField('generation', mtMap.passthrough()),
      value: mtMap.objectField('value', mtMap.passthrough()),
      webhookUrl: mtMap.objectField('webhook_url', mtMap.passthrough())
    }
  );

