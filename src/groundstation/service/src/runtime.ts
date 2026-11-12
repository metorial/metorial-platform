import { createTenantKeyDeriver, type TenantKeyDeriver } from './crypto/keys';
import { env } from './env';
import { createMemorySink, type MemorySink } from './sink/memory';
import { createNdjsonSink } from './sink/ndjson';
import { createNoopSink } from './sink/noop';
import type { RecordSink } from './sink/types';

export type IngestRuntime = {
  sink: RecordSink;
  keys: TenantKeyDeriver;
  clock: () => Date;
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

  return { sink: createNoopSink() };
};

let current: IngestRuntime | undefined;

export let createRuntime = (overrides: Partial<IngestRuntime> = {}): IngestRuntime => {
  let fromEnv = overrides.sink ? undefined : createSinkFromEnv();

  return {
    sink: overrides.sink ?? fromEnv!.sink,
    memorySink: overrides.memorySink ?? fromEnv?.memorySink,
    keys: overrides.keys ?? createTenantKeyDeriver(env.records.hashSecret),
    clock: overrides.clock ?? (() => new Date())
  };
};

export let getRuntime = (): IngestRuntime => (current ??= createRuntime());

export let setRuntime = (runtime: IngestRuntime | undefined) => {
  current = runtime;
};
