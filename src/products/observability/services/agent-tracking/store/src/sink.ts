import { createError } from '@lowerdeck/error';
import type { NormalizedRecord, RecordLane } from '@mtsrc/agent-tracking-spec';

export let sinkBusyRetryAfterSeconds = 5;

export let sinkBusyError = createError({
  status: 503,
  code: 'sink_busy',
  message: 'The service cannot accept more records right now.',
  hint: 'Retry the whole request after the Retry-After delay.'
});

export type StoragePolicy = {
  recordRetentionDays: number;
  contentRetentionDays: number;
  contentKeyVersion: number;
};

export let defaultStoragePolicy: StoragePolicy = {
  recordRetentionDays: 90,
  contentRetentionDays: 30,
  contentKeyVersion: 1
};

export type RecordBatch = {
  lane: RecordLane;
  organizationId: string;
  projectId: string;
  instanceId: string;
  storage: StoragePolicy;
  records: NormalizedRecord[];
};

export type RecordSink = {
  write: (batch: RecordBatch) => Promise<void>;
  close?: () => Promise<void>;
};
