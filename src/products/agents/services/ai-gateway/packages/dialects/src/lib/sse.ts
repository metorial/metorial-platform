import type { SseEvent } from './types';

export let serializeSseEvent = (event: SseEvent) =>
  `${event.event ? `event: ${event.event}\n` : ''}data: ${event.data}\n\n`;

export let sseHeaders = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  'x-accel-buffering': 'no'
};
