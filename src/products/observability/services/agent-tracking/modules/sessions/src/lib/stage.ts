import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import {
  createOrganizationKeyDeriver,
  type OrganizationKeyDeriver
} from '@mtsrc/agent-tracking-crypto';
import { env } from '../env';
import type { PipelineContext, PipelineStage } from '@mtsrc/agent-tracking-module-ingest';
import { queueSessionSettle } from '../queues/sessionSettle';
import { queueSessionlessSlices, type SessionlessBucket } from '../queues/sessionlessSlices';
import { getStore } from '@mtsrc/agent-tracking-store';
import { assignSessions, type SessionAssignment } from './assign';
import { isSessionlessUsage, sessionlessBucket } from './sessionless';
import { writeSessions } from './write';

export type SessionStageOptions = { keys?: OrganizationKeyDeriver };

let sessionlessBuckets = (records: NormalizedRecord[]) => {
  let buckets = new Map<string, SessionlessBucket>();

  for (let record of records) {
    if (!isSessionlessUsage(record)) continue;

    let { bucket } = sessionlessBucket({
      occurredAt: new Date(record.occurred_at),
      window: record.data.window
    });

    let entry = {
      organizationId: record.ingest.organization_id,
      instanceId: record.ingest.instance_id,
      bucket: bucket.toISOString()
    };
    buckets.set(`${entry.instanceId}:${entry.bucket}`, entry);
  }

  return [...buckets.values()];
};

let collections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};

export let createSessionStage = (opts: SessionStageOptions = {}): PipelineStage => {
  let keys = opts.keys;
  let keysOf = () => (keys ??= createOrganizationKeyDeriver(env.records.hashSecret));

  let assignments = new WeakMap<PipelineContext, SessionAssignment>();

  return {
    name: 'sessions',

    beforeWrite: async (context, records) => {
      let { principal } = context.request;

      let assignment = await assignSessions({
        principal,
        organizationKey: keysOf().forOrganization(principal.organization),
        records,
        collections: await collections()
      });

      assignments.set(context, assignment);
    },

    afterWrite: async (context, records) => {
      let assignment = assignments.get(context) ?? {
        inferKeys: new Map(),
        inferred: new Map()
      };
      assignments.delete(context);

      let { sessionKeys } = await writeSessions({
        principal: context.request.principal,
        records,
        observedAt: context.observedAt,
        assignment,
        collections: await collections()
      });

      await Promise.all([
        queueSessionSettle(sessionKeys),
        queueSessionlessSlices(sessionlessBuckets(records))
      ]);
    }
  };
};
