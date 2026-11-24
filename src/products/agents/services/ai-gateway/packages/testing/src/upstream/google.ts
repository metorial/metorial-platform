import { chunksOf, finishOf, usageOf, type Script } from '../script';
import type { WireEvent } from './sse';

let finishReasons = {
  stop: 'STOP',
  'stop-sequence': 'STOP',
  length: 'MAX_TOKENS',
  'tool-calls': 'STOP',
  'content-filter': 'SAFETY'
} as const;

export let googleEvents = (script: Script, model: string): WireEvent[] => {
  let chunk = (parts: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
    data: {
      candidates: [{ content: { role: 'model', parts }, index: 0, ...extra }],
      modelVersion: model,
      responseId: script.id ?? 'google-fake'
    }
  });

  let events: WireEvent[] = [];

  for (let step of script.steps) {
    if (step.type == 'reasoning') {
      let deltas = chunksOf(step.text, script.chunkSize);
      deltas.forEach((delta, index) =>
        events.push(
          chunk([
            {
              text: delta,
              thought: true,
              ...(index == deltas.length - 1 && step.signature
                ? { thoughtSignature: step.signature }
                : {})
            }
          ])
        )
      );
      continue;
    }

    if (step.type == 'text') {
      for (let delta of chunksOf(step.text, script.chunkSize))
        events.push(chunk([{ text: delta }]));
      continue;
    }

    events.push(chunk([{ functionCall: { name: step.name, args: step.input } }]));
  }

  if (script.failMidStream) {
    events.push({
      data: { error: { code: 500, message: script.failMidStream.message, status: 'INTERNAL' } }
    });
    return events;
  }

  let usage = usageOf(script);
  events.push({
    data: {
      ...chunk([{ text: '' }], { finishReason: finishReasons[finishOf(script)] }).data,
      usageMetadata: {
        promptTokenCount: usage.input + usage.cacheRead,
        cachedContentTokenCount: usage.cacheRead,
        candidatesTokenCount: usage.output - usage.reasoning,
        thoughtsTokenCount: usage.reasoning,
        totalTokenCount: usage.input + usage.cacheRead + usage.output
      }
    }
  });

  return events;
};
