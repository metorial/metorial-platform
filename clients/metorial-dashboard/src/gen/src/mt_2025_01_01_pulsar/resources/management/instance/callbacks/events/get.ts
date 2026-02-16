import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCallbacksEventsGetOutput = {
  object: 'callback.event';
  id: string;
  status: 'pending' | 'succeeded' | 'retrying' | 'failed';
  type: string | null;
  payloadIncoming: string;
  payloadOutgoing: string | null;
  createdAt: Date;
  processingAttempts: {
    object: 'callback.event.attempt';
    id: string;
    status: 'succeeded' | 'failed';
    index: number;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }[];
};

export let mapManagementInstanceCallbacksEventsGetOutput =
  mtMap.object<ManagementInstanceCallbacksEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    payloadIncoming: mtMap.objectField('payload_incoming', mtMap.passthrough()),
    payloadOutgoing: mtMap.objectField('payload_outgoing', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    processingAttempts: mtMap.objectField(
      'processing_attempts',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          index: mtMap.objectField('index', mtMap.passthrough()),
          errorCode: mtMap.objectField('error_code', mtMap.passthrough()),
          errorMessage: mtMap.objectField('error_message', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    )
  });

