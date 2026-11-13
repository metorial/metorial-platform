import { createOrganizationKeyDeriver, type OrganizationKeyDeriver } from './crypto/keys';
import { env } from './env';
import { createDefaultStages, type PipelineStage } from './pipeline';
import { createMemorySink, type MemorySink } from './sink/memory';
import { createMongoSink } from './sink/mongo';
import { createNdjsonSink } from './sink/ndjson';
import { createNoopSink } from './sink/noop';
import { getStore } from './store/connection';
import { createContentCipher } from './store/contentCipher';
import type { RecordSink } from './sink/types';

export type IngestRuntime = {
  sink: RecordSink;
  keys: OrganizationKeyDeriver;
  clock: () => Date;
  stages: PipelineStage[];
  memorySink?: MemorySink;
};

let createSinkFromEnv = (): { sink: RecordSink; memorySink?: MemorySink } => {
  let kind = env.records.sink ?? 'noop';

  if (kind == 'memory') {
    let memorySink = createMemorySink();
    return { sink: memorySink, memorySink };
  }

  if (kind == 'ndjson') {
    let file = env.records.sinkFile;
    if (!file) throw new Error('GROUNDSTATION_SINK_FILE is required for the ndjson sink.');

    return { sink: createNdjsonSink(file) };
  }

  if (kind == 'mongo') {
    let secret = env.records.contentSecret;
    if (!secret) {
      throw new Error('GROUNDSTATION_CONTENT_SECRET is required for the mongo sink.');
    }

    return {
      sink: createMongoSink({ store: getStore(), cipher: createContentCipher(secret) })
    };
  }

  return { sink: createNoopSink() };
};

let current: IngestRuntime | undefined;

export let createRuntime = (overrides: Partial<IngestRuntime> = {}): IngestRuntime => {
  let fromEnv = overrides.sink ? undefined : createSinkFromEnv();

  return {
    sink: overrides.sink ?? fromEnv!.sink,
    memorySink: overrides.memorySink ?? fromEnv?.memorySink,
    keys: overrides.keys ?? createOrganizationKeyDeriver(env.records.hashSecret),
    clock: overrides.clock ?? (() => new Date()),
    stages: overrides.stages ?? (overrides.sink ? [] : createDefaultStages())
  };
};

export let getRuntime = (): IngestRuntime => (current ??= createRuntime());

export let setRuntime = (runtime: IngestRuntime | undefined) => {
  current = runtime;
};
