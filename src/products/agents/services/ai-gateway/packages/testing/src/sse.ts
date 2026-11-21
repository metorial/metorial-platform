export type ParsedSseEvent = { event?: string; data: string; json?: any };

export let parseSse = (text: string): ParsedSseEvent[] =>
  text
    .split(/\n\n/)
    .filter(block => block.trim().length)
    .map(block => {
      let event: string | undefined;
      let data: string[] = [];

      for (let line of block.split('\n')) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }

      let joined = data.join('\n');
      let json: unknown;
      try {
        json = joined == '[DONE]' ? undefined : JSON.parse(joined);
      } catch {}

      return { event, data: joined, json };
    })
    .filter(event => event.data.length || event.event);

export let readSse = async (body: Response | ReadableStream<Uint8Array> | string) =>
  parseSse(typeof body == 'string' ? body : await new Response(body as any).text());
