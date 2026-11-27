import { chatEventNames } from '@metorial/webhook-event-schema/src/events/chat/names';
import { chatTriggers } from '@slates/adapter-chat';
import { describe, expect, it } from 'vitest';

// `ChatEvent.type`, and therefore the catalog name customers subscribe to, is the `type` literal
// the adapter's trigger emits -- not the trigger key, which carries the `metorial_chat$` prefix.
let liveEventTypes = new Set(
  Object.values(chatTriggers).map(trigger => {
    let literal = (trigger.output as any).shape?.type;
    if (typeof literal?.value !== 'string') {
      throw new Error(`Trigger ${trigger.key} has no literal \`type\` in its output schema`);
    }
    return literal.value as string;
  })
);

describe('chat event catalog', () => {
  it('declares only events the chat adapter can actually emit', () => {
    expect(chatEventNames.filter(name => !liveEventTypes.has(name))).toEqual([]);
  });
});
