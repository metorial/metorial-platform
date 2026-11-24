import { serializeSseEvent, sseHeaders, type SseEvent } from '@mtsrc/ai-gateway-dialects';

let encoder = new TextEncoder();
let keepAlive = encoder.encode(': ping\n\n');

// Reasoning models can think for minutes before their first token. A comment line every few
// seconds keeps proxies and load balancers from closing the idle connection; every SSE parser
// ignores comments.
export let sseResponse = (d: {
  events: ReadableStream<SseEvent>;
  headers: Record<string, string>;
  keepAliveMs: number;
}) => {
  let reader = d.events.getReader();
  let timer: ReturnType<typeof setInterval> | undefined;

  let body = new ReadableStream<Uint8Array>({
    start: controller => {
      timer = setInterval(() => {
        try {
          controller.enqueue(keepAlive);
        } catch {
          clearInterval(timer);
        }
      }, d.keepAliveMs);
    },

    pull: async controller => {
      let next = await reader.read();
      if (next.done) {
        clearInterval(timer);
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(serializeSseEvent(next.value)));
    },

    cancel: async reason => {
      clearInterval(timer);
      await reader.cancel(reason);
    }
  });

  return new Response(body, { status: 200, headers: { ...sseHeaders, ...d.headers } });
};
