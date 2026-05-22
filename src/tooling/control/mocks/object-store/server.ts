let store = new Map<string, { body: Uint8Array; contentType?: string }>();

let port = Number(process.env.PORT || 52010);

let server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    let url = new URL(req.url);
    let path = url.pathname;

    if (path === '/health' || path === '/ping') {
      return new Response('ok', { status: 200 });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      let body = new Uint8Array(await req.arrayBuffer());
      store.set(path, { body, contentType: req.headers.get('content-type') ?? undefined });
      return new Response(null, { status: 200 });
    }

    if (req.method === 'HEAD') {
      let entry = store.get(path);
      if (!entry) return new Response(null, { status: 404 });
      return new Response(null, {
        status: 200,
        headers: {
          'content-length': String(entry.body.byteLength),
          ...(entry.contentType ? { 'content-type': entry.contentType } : {})
        }
      });
    }

    if (req.method === 'GET') {
      let entry = store.get(path);
      if (!entry) return new Response(null, { status: 404 });
      return new Response(entry.body, {
        status: 200,
        headers: entry.contentType ? { 'content-type': entry.contentType } : undefined
      });
    }

    if (req.method === 'DELETE') {
      store.delete(path);
      return new Response(null, { status: 204 });
    }

    return new Response('noop object-store mock', { status: 200 });
  }
});

console.log(`object-store mock listening on ${server.hostname}:${server.port}`);
