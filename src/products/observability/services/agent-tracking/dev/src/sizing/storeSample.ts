import mongoose from 'mongoose';
import type { Store } from '@mtsrc/agent-tracking-store';
import { dayMs } from '../lib/clock';
import { mean } from '../lib/stats';

let settledAfterMs = dayMs;

let recordRetentionMs = 80 * dayMs;

let sessionOversample = 5;

let size = (document: unknown) => mongoose.mongo.BSON.calculateObjectSize(document as object);

type Samples = {
  events: object[];
  measurements: object[];
  slices: object[];
  sessions: object[];
};

type Counts = {
  events: number;
  measurements: number;
  recordsPerSession: number[];
  slicesPerSession: number[];
};

export let sizesOf = (samples: Samples, counts: Counts) => {
  let measurementShare = counts.events > 0 ? counts.measurements / counts.events : 0;

  let byType: Record<string, number[]> = {};
  for (let event of samples.events) {
    (byType[String((event as { type?: unknown }).type)] ??= []).push(size(event));
  }

  let eventBytes = mean(samples.events.map(size));
  let measurementBytes = mean(samples.measurements.map(size));
  let eventsPerSession = mean(counts.recordsPerSession);

  return {
    sample: {
      events: samples.events.length,
      measurements: samples.measurements.length,
      sessions: samples.sessions.length,
      slices: samples.slices.length,
      perSession: counts.recordsPerSession.length
    },
    bytesPerRecord:
      eventBytes === null
        ? null
        : (eventBytes + measurementShare * (measurementBytes ?? eventBytes)) /
          (1 + measurementShare),
    bytesPerRecordByType: Object.fromEntries(
      Object.entries(byType).map(([type, sizes]) => [type, Math.round(mean(sizes)!)])
    ),
    recordsPerSession:
      eventsPerSession === null ? null : eventsPerSession * (1 + measurementShare),
    slicesPerSession: mean(counts.slicesPerSession),
    bytesPerSlice: mean(samples.slices.map(size)),
    bytesPerSession: mean(samples.sessions.map(size))
  };
};

// Read-only and bounded: `$sample` picks documents without scanning, and each sampled session is
// counted through the organization + session-key indexes.
export let sampleStoreSizes = async (d: { store: Store; sample: number; now?: Date }) => {
  let now = (d.now ?? new Date()).getTime();
  let perSession = Math.max(1, Math.min(200, Math.floor(d.sample / 10)));

  let collections = d.store.collections();

  let sampleOf = async (
    collection: 'events' | 'measurements' | 'sessions' | 'usageSlices',
    count: number
  ) => await collections[collection].aggregate([{ $sample: { size: count } }]).toArray();

  let samples = {
    events: await sampleOf('events', d.sample),
    measurements: await sampleOf('measurements', Math.max(1, Math.floor(d.sample / 4))),
    slices: await sampleOf('usageSlices', d.sample),
    sessions: await sampleOf('sessions', d.sample)
  };

  let settled = (await collections.sessions
    .aggregate([
      { $sample: { size: perSession * sessionOversample } },
      {
        $match: {
          lastActivityAt: {
            $lt: new Date(now - settledAfterMs),
            $gt: new Date(now - recordRetentionMs)
          }
        }
      },
      { $limit: perSession },
      { $project: { _id: 1, organizationId: 1 } }
    ])
    .toArray()) as { _id: string; organizationId: string }[];

  let counts: Counts = {
    events: await collections.events.estimatedDocumentCount(),
    measurements: await collections.measurements.estimatedDocumentCount(),
    recordsPerSession: [],
    slicesPerSession: []
  };

  for (let session of settled) {
    counts.recordsPerSession.push(
      await collections.events.countDocuments({
        organizationId: session.organizationId,
        'ctx.sessionKey': session._id
      })
    );
    counts.slicesPerSession.push(
      await collections.usageSlices.countDocuments({
        organizationId: session.organizationId,
        sessionKey: session._id
      })
    );
  }

  return sizesOf(samples, counts);
};
