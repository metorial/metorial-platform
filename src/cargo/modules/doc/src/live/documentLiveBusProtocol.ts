export type DocumentLiveBusMessageType =
  | 'yjs_update'
  | 'awareness_update'
  | 'awareness_remove'
  | 'document_snapshot'
  | 'document_snapshot_saved'
  | 'participant_list';

export type DocumentLiveBusMessage = {
  originInstanceId: string;
  originSessionId?: string;
  documentId: string;
  type: DocumentLiveBusMessageType;
  data: any;
};

export let isDocumentLiveBusMessage = (message: any): message is DocumentLiveBusMessage =>
  !!message &&
  typeof message == 'object' &&
  typeof message.originInstanceId == 'string' &&
  typeof message.documentId == 'string' &&
  typeof message.type == 'string' &&
  'data' in message;

export let shouldDeliverBusMessage = (message: DocumentLiveBusMessage, instanceId: string) =>
  message.originInstanceId !== instanceId;
