import { vi } from 'vitest';
import { Events } from '../src/bus';
import { type AgentTrackingEvents } from '../src/catalog';

let fire = Events.fire;

let captured = new Map<string, (data: never) => Promise<void>>();

export let captureEvents = <K extends keyof AgentTrackingEvents>(events: readonly K[]) => {
  let recorder = vi.fn(async (_data: AgentTrackingEvents[K]) => {});
  for (let event of events) captured.set(event, recorder as never);

  Events.fire = (async (event, data) => {
    let capture = captured.get(event);
    if (capture) return await capture(data as never);

    return await fire(event, data);
  }) as typeof Events.fire;

  return recorder;
};
