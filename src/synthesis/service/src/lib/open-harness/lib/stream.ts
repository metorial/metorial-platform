import type { AgentEvent } from '../agent';

type StreamTransform = (source: AsyncIterable<AgentEvent>) => AsyncGenerator<AgentEvent>;

/** Observe events without modifying the stream. */
export function tap(fn: (event: AgentEvent) => void): StreamTransform {
  return async function* (source) {
    for await (const event of source) {
      fn(event);
      yield event;
    }
  };
}

/** Drop events that don't match the predicate. Never filters `done` events. */
export function filter(predicate: (event: AgentEvent) => boolean): StreamTransform {
  return async function* (source) {
    for await (const event of source) {
      if (event.type === 'done' || predicate(event)) {
        yield event;
      }
    }
  };
}

/** Transform each event. */
export function map(fn: (event: AgentEvent) => AgentEvent): StreamTransform {
  return async function* (source) {
    for await (const event of source) {
      yield fn(event);
    }
  };
}

/** Stop iteration after predicate matches (inclusive — the matching event is yielded). */
export function takeUntil(predicate: (event: AgentEvent) => boolean): StreamTransform {
  return async function* (source) {
    for await (const event of source) {
      yield event;
      if (predicate(event)) return;
    }
  };
}
