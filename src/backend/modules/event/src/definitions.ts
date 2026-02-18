import { File, FilePurpose } from '@metorial/db';

export type EventTypesFilePayload = {
  file: File & { purpose: FilePurpose };
};

export type EventTypes = {
  // 'file:created': EventTypesFilePayload;
  // 'file:updated': EventTypesFilePayload;
  // 'file:deleted': EventTypesFilePayload;
};
