import { toRecordDocument } from '@mtsrc/agent-tracking-module-records';
import { defaultStoragePolicy } from '@mtsrc/agent-tracking-store';
import { realClock } from '../lib/clock';
import { createInProcessIngest } from '../load/dryRun';
import { encodeLiveRequest } from '../load/payload';
import type { TrafficProfile } from '../load/profile';
import { createBatchStream } from '../load/synth';
import type { EventTemplates } from './documents';

let maxBatches = 500;

// One stored document per event type, produced by the real ingest path from synthetic Claude Code
// telemetry, so seeded events have the shape the service writes.
export let buildEventTemplates = async (profile: TrafficProfile, seed: number) => {
  let { sink, send } = createInProcessIngest();
  let stream = createBatchStream({
    profile,
    seed,
    developers: 1,
    sessions: 1,
    clock: realClock.now
  });
  let wanted = new Set<keyof EventTemplates>([
    'model.request',
    'tool.call',
    'prompt.submitted',
    'tool.decision'
  ]);
  let templates: Partial<EventTemplates> = {};
  let now = new Date();

  for (let batch = 0; batch < maxBatches && wanted.size > 0; batch++) {
    let next = stream.next();
    let response = await send(
      encodeLiveRequest(next.group, next.expected.length, {
        format: 'protobuf',
        compression: 'none'
      })
    );
    if (response.status != 200)
      throw new Error(`The in-process ingest answered ${response.status}.`);

    for (let item of sink.list()) {
      let type = item.record.type as keyof EventTemplates;
      if (!wanted.has(type)) continue;
      if (
        type == 'model.request' &&
        (item.record.data as { outcome?: string }).outcome != 'ok'
      ) {
        continue;
      }

      let mapped = toRecordDocument(item.record, { storage: defaultStoragePolicy, now });
      if (!mapped) continue;

      templates[type] = mapped.document;
      wanted.delete(type);
    }

    sink.clear();
  }

  if (wanted.size > 0) {
    throw new Error(
      `No template for ${[...wanted].join(', ')}; raise the profile's tool share.`
    );
  }

  return templates as EventTemplates;
};
