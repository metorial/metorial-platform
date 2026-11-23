import type { CollectedResponse } from './collect';

// A response that produced tool calls is a tool turn, even when the provider reported a plain
// stop (Gemini does, since it has no tool-specific finish reason).
export let effectiveFinish = (
  collected: Pick<CollectedResponse, 'finishReason' | 'content'>
) => {
  let unified = collected.finishReason.unified;
  if (unified == 'stop' && collected.content.some(part => part.type == 'tool-call')) {
    return 'tool-calls';
  }

  return unified;
};

export let toUnixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);
