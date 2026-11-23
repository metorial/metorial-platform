import type { SharedV4ProviderMetadata } from '@ai-sdk/provider';

// `metadata` (sent on the end part) and `startMetadata` replace the provider metadata the mock
// model would derive for a step, to emulate a specific provider. `streamInput: false` emits a
// tool call without input deltas, which some providers do. Fake upstreams ignore all three.
export type ScriptStep =
  | { type: 'text'; text: string }
  | {
      type: 'reasoning';
      text: string;
      id?: string;
      signature?: string;
      redacted?: string;
      metadata?: SharedV4ProviderMetadata;
      startMetadata?: SharedV4ProviderMetadata;
    }
  | {
      type: 'tool-call';
      id: string;
      name: string;
      input: Record<string, unknown>;
      streamInput?: boolean;
    };

export type ScriptFinish =
  'stop' | 'length' | 'tool-calls' | 'content-filter' | 'stop-sequence';

export type ScriptUsage = {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
};

// A provider-neutral description of one model response. The mock model turns it into AI SDK
// stream parts; the fake upstreams turn it into each vendor's real wire format.
export type Script = {
  id?: string;
  model?: string;
  steps: ScriptStep[];
  finish?: ScriptFinish;
  finishMetadata?: SharedV4ProviderMetadata;
  usage?: ScriptUsage;
  chunkSize?: number;
  failMidStream?: { message: string };
  httpError?: { status: number; body: unknown; headers?: Record<string, string> };
};

export let defaultUsage: Required<ScriptUsage> = {
  input: 12,
  output: 7,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0
};

export let usageOf = (script: Script): Required<ScriptUsage> => ({
  ...defaultUsage,
  ...script.usage
});

export let finishOf = (script: Script): ScriptFinish =>
  script.finish ??
  (script.steps.some(step => step.type == 'tool-call') ? 'tool-calls' : 'stop');

export let chunksOf = (text: string, size = 4) => {
  if (!text.length) return [''];

  let chars = Array.from(text);
  let chunks: string[] = [];
  for (let index = 0; index < chars.length; index += size) {
    chunks.push(chars.slice(index, index + size).join(''));
  }

  return chunks;
};

export let textOf = (script: Script) =>
  script.steps.flatMap(step => (step.type == 'text' ? [step.text] : [])).join('');
