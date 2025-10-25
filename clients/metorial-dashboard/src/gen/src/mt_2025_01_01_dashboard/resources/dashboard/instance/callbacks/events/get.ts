import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksEventsGetOutput = {
  object: 'callback.event';
  id: string;
  type: string | null;
  status: 'pending' | 'succeeded' | 'retrying' | 'failed';
  payloadIncoming: string;
  payloadOutgoing: string | null;
  processingAttempts: {
    object: 'callback.event.attempt';
    id: string;
    status: 'succeeded' | 'failed';
    index: number;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }[];
  createdAt: Date;
};

export let mapDashboardInstanceCallbacksEventsGetOutput =
  mtMap.object<DashboardInstanceCallbacksEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    payloadIncoming: mtMap.objectField('payload_incoming', mtMap.passthrough()),
    payloadOutgoing: mtMap.objectField('payload_outgoing', mtMap.passthrough()),
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
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

