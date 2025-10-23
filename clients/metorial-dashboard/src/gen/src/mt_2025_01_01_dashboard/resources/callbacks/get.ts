import { mtMap } from '@metorial/util-resource-mapper';

export type CallbacksGetOutput = {
  object: 'callback';
  id: string;
  url: string | null;
  type: 'webhook_managed' | 'polling' | 'webhook_manual';
  schedule: {
    object: 'callback.schedule';
    intervalSeconds: number;
    nextRunAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapCallbacksGetOutput = mtMap.object<CallbacksGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  url: mtMap.objectField('url', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough()),
  schedule: mtMap.objectField(
    'schedule',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      intervalSeconds: mtMap.objectField(
        'interval_seconds',
        mtMap.passthrough()
      ),
      nextRunAt: mtMap.objectField('next_run_at', mtMap.date())
    })
  ),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});

