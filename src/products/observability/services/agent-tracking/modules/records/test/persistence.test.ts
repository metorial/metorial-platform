import { afterEach, describe, expect, it } from 'vitest';
import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import { defaultStoragePolicy } from '@mtsrc/agent-tracking-store';
import { createMemorySink } from '../src/lib/memory';
import { storedRecords } from '../src/lib/persistence';
import { setConfiguredSink } from '../src/lib/sink';
import { recordWriteService } from '../src/services/recordWrite';

let record = (id: string, type: string, data: Record<string, unknown> = {}) =>
  ({ id, type, data }) as NormalizedRecord;

let records = [
  record('a', 'model.request'),
  record('b', 'unmapped', { native_name: 'hook_registered', category: 'diagnostic' }),
  record('c', 'extension.event', { kind: 'plugin', action: 'loaded' }),
  record('d', 'extension.event', { kind: 'plugin', action: 'installed' }),
  record('e', 'extension.event', { kind: 'skill', action: 'activated' }),
  record('f', 'mcp.connection'),
  record('g', 'hook.run'),
  record('h', 'session.context')
];

let batch = (items: NormalizedRecord[]) => ({
  lane: 'live' as const,
  organizationId: 'ator_1',
  projectId: 'atpr_1',
  instanceId: 'atin_1',
  storage: defaultStoragePolicy,
  records: items
});

afterEach(() => setConfiguredSink(undefined));

describe('storedRecords', () => {
  it('leaves out unknown events and plugin loads, and keeps everything else', () => {
    expect(storedRecords(records).map(item => item.id)).toEqual([
      'a',
      'd',
      'e',
      'f',
      'g',
      'h'
    ]);
  });
});

describe('recordWriteService', () => {
  it('writes only the records that are stored', async () => {
    let sink = createMemorySink();
    setConfiguredSink(sink);

    await recordWriteService.write({ batch: batch(records) });

    expect(sink.list({}).map(item => item.record.id)).toEqual(['a', 'd', 'e', 'f', 'g', 'h']);
  });

  it('does not call the sink for a batch with nothing to store', async () => {
    let sink = createMemorySink();
    sink.setBusy(true);
    setConfiguredSink(sink);

    await recordWriteService.write({ batch: batch([records[1]!, records[2]!]) });

    expect(sink.list({})).toEqual([]);
  });
});
