import type { NormalizedRecord, RecordLane } from '@mtsrc/agent-tracking-spec';
import type { Mapped } from '@mtsrc/agent-tracking-dialects';
import { recordWriteService } from '@mtsrc/agent-tracking-module-records';
import { runAfterWrite, runBeforeWrite } from './run';
import { buildRecord } from '@mtsrc/agent-tracking-records-model';
import type { IngestCall } from './call';
import { getRuntime } from './runtime';

export type CollectorOptions = {
  route: NormalizedRecord['ingest']['route'];
  lane: RecordLane;
  batchId?: string;
  agent?: NormalizedRecord['ingest']['agent'];
  arrivalIsEventTime?: boolean;
  oldestAllowed?: number | null;
};

export type CollectOutcome = 'added' | 'unbuildable' | 'too_old';

export type RecordCollector = {
  add: (
    mapped: Mapped[],
    itemObservedAt?: Date | null,
    oldestAllowed?: number | null
  ) => CollectOutcome;
  size: () => number;
  flush: () => Promise<number>;
};

export let createCollector = (
  call: IngestCall,
  options: CollectorOptions
): RecordCollector => {
  let runtime = getRuntime();
  let { principal } = call;

  let organizationKey = runtime.keys.forOrganization(principal.organization);

  let observedAt = runtime.clock();
  let records = new Map<string, NormalizedRecord>();

  return {
    add: (mapped, itemObservedAt, itemOldestAllowed): CollectOutcome => {
      let built: NormalizedRecord[];

      try {
        built = mapped.map(({ source, draft }) =>
          buildRecord(
            {
              principal,
              organizationKey,
              requestId: call.requestId,
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
        return 'unbuildable';
      }

      let oldestAllowed =
        itemOldestAllowed === undefined ? options.oldestAllowed : itemOldestAllowed;

      if (
        typeof oldestAllowed == 'number' &&
        built.some(record => Date.parse(record.occurred_at) < oldestAllowed)
      ) {
        return 'too_old';
      }

      for (let record of built) {
        if (!records.has(record.id)) records.set(record.id, record);
      }

      return 'added';
    },

    size: () => records.size,

    flush: async () => {
      if (records.size == 0) return 0;

      let batch = [...records.values()];
      let context = { request: call, lane: options.lane, observedAt };

      await runBeforeWrite(runtime.stages, context, batch);

      await recordWriteService.write({
        batch: {
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
        }
      });

      await runAfterWrite(runtime.stages, context, batch);

      return batch.length;
    }
  };
};
