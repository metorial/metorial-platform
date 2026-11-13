import type { NormalizedRecord, RecordLane } from '@metorial/groundstation-spec';
import type { Mapped } from '../dialects/types';
import { runAfterWrite, runBeforeWrite } from '../pipeline';
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

  let organizationKey = runtime.keys.forOrganization(principal.organization);

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
              organizationKey,
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
      let context = { request, lane: options.lane, observedAt };

      await runBeforeWrite(runtime.stages, context, batch);

      await runtime.sink.write({
        lane: options.lane,
        organizationId: principal.organization.id,
        projectId: principal.project.id,
        instanceId: principal.instance.id,
        storage: {
          recordRetentionDays: principal.instance.recordRetentionDays,
          contentRetentionDays: principal.instance.contentRetentionDays,
          contentKeyVersion: principal.organization.contentKeyVersion
        },
        records: batch
      });

      await runAfterWrite(runtime.stages, context, batch);

      return batch.length;
    }
  };
};
