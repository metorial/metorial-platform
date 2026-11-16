import { createContentCipher } from '@mtsrc/agent-tracking-crypto';
import { getStore, type RecordSink } from '@mtsrc/agent-tracking-store';
import { env } from '../env';
import { createMemorySink, type MemorySink } from './memory';
import { createMongoSink } from './mongo';
import { createNdjsonSink } from './ndjson';
import { createNoopSink } from './noop';

export type ConfiguredSink = { sink: RecordSink; readback?: MemorySink };

let createSinkFromEnv = (): ConfiguredSink => {
  let kind = env.records.sink ?? 'noop';

  if (kind == 'memory') {
    let sink = createMemorySink();
    return { sink, readback: sink };
  }

  if (kind == 'ndjson') {
    let file = env.records.sinkFile;
    if (!file) throw new Error('AGENT_TRACKING_SINK_FILE is required for the ndjson sink.');

    return { sink: createNdjsonSink(file) };
  }

  if (kind == 'mongo') {
    let secret = env.records.contentSecret;
    if (!secret) {
      throw new Error('AGENT_TRACKING_CONTENT_SECRET is required for the mongo sink.');
    }

    return {
      sink: createMongoSink({ store: getStore(), cipher: createContentCipher(secret) })
    };
  }

  return { sink: createNoopSink() };
};

let current: ConfiguredSink | undefined;

export let getConfiguredSink = () => (current ??= createSinkFromEnv());

export let setConfiguredSink = (sink: RecordSink | MemorySink | undefined) => {
  current = sink ? { sink, readback: 'list' in sink ? sink : undefined } : undefined;
};
