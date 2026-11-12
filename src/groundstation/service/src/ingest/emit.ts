import type { NormalizedRecord, RecordLane } from '@metorial/groundstation-spec';
import type { Mapped } from '../dialects/types';
import { buildRecord } from '../records/builder';
import { getRuntime } from '../runtime';
import type { AuthenticatedIngestRequest } from './request';

export type CollectorOptions = {
  route: NormalizedRecord['ingest']['route'];
  lane: RecordLane;
  batchId?: string;
  agent?: NormalizedRecord['ingest']['agent'];
  arrivalIsEventTime?: boolean;
};

export type RecordCollector = {
  add: (mapped: Mapped[], itemObservedAt?: Date | null) => boolean;
  size: () => number;
  flush: () => Promise<number>;
};

export let createCollector = (
  request: AuthenticatedIngestRequest,
  options: CollectorOptions
): RecordCollector => {
  let runtime = getRuntime();
  let { principal } = request;

  let tenantKey = runtime.keys.forTenant({
    id: principal.tenant.id,
    hashKeyVersion: principal.tenant.hashKeyVersion
  });

  let observedAt = runtime.clock();
  let records = new Map<string, NormalizedRecord>();

  return {
    add: (mapped, itemObservedAt) => {
      let built: NormalizedRecord[];

      try {
        built = mapped.map(({ source, draft }) =>
          buildRecord(
            {
              principal,
              tenantKey,
              requestId: request.requestId,
              route: options.route,
              observedAt,
              lane: options.lane,
              batchId: options.batchId,
              agent: options.agent,
              arrivalIsEventTime: options.arrivalIsEventTime,
              itemObservedAt
            },
            source,
            draft
          )
        );
      } catch {
        return false;
      }

      for (let record of built) {
        if (!records.has(record.id)) records.set(record.id, record);
      }

      return true;
    },

    size: () => records.size,

    flush: async () => {
      if (records.size == 0) return 0;

      let batch = [...records.values()];

      await runtime.sink.write({
        lane: options.lane,
        tenantId: principal.tenant.id,
        storage: {
          recordRetentionDays: principal.tenant.recordRetentionDays,
          contentRetentionDays: principal.tenant.contentRetentionDays,
          contentKeyVersion: principal.tenant.contentKeyVersion
        },
        records: batch
      });

      return batch.length;
    }
  };
};
