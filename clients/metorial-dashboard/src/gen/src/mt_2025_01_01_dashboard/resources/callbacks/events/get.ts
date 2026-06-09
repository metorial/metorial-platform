import { mtMap } from '@metorial/util-resource-mapper';

export type CallbacksEventsGetOutput = {
  object: 'callback.event';
  id: string;
  type: string;
  sourceId: string;
  triggerKey: string;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  status:
    | 'pending'
    | 'processing'
    | 'retrying'
    | 'succeeded'
    | 'failed'
    | 'skipped';
  error: { code: string | null; message: string | null } | null;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  callbackId: string;
  callbackInstanceId: string | null;
  createdAt: Date;
};

export let mapCallbacksEventsGetOutput = mtMap.object<CallbacksEventsGetOutput>(
  {
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    sourceId: mtMap.objectField('source_id', mtMap.passthrough()),
    triggerKey: mtMap.objectField('trigger_key', mtMap.passthrough()),
    input: mtMap.objectField('input', mtMap.passthrough()),
    output: mtMap.objectField('output', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    error: mtMap.objectField(
      'error',
      mtMap.object({
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough())
      })
    ),
    deliveryStatus: mtMap.objectField('delivery_status', mtMap.passthrough()),
    callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
    callbackInstanceId: mtMap.objectField(
      'callback_instance_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  }
);

