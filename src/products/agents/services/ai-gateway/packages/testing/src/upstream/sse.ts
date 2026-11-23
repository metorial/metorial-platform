export type WireEvent = { event?: string; data: unknown };

let encoder = new TextEncoder();

export let encodeWireEvent = (event: WireEvent) =>
  `${event.event ? `event: ${event.event}\n` : ''}data: ${
    typeof event.data == 'string' ? event.data : JSON.stringify(event.data)
  }\n\n`;

// Splitting the body at fixed byte offsets (instead of at event boundaries) makes sure SSE
// parsers on the other end cope with events and multi-byte characters cut across reads.
export let sseResponse = (
  events: WireEvent[],
  d: { fragmentBytes?: number; headers?: Record<string, string> } = {}
) => {
  let chunks = events.map(event => encoder.encode(encodeWireEvent(event)));

  if (d.fragmentBytes) {
    let joined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    for (let chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }

    chunks = [];
    for (let index = 0; index < joined.length; index += d.fragmentBytes) {
      chunks.push(joined.slice(index, index + d.fragmentBytes));
    }
  }

  let body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      let chunk = chunks.shift();
      if (!chunk) {
        controller.close();
        return;
      }

      controller.enqueue(chunk);
      await Promise.resolve();
    }
  });

  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', ...d.headers }
  });
};
