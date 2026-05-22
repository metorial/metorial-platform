type RpcCall = { id: string; name: string; payload: any };

let counter = 0;
let port = Number(process.env.PORT || 52060);

let handlers: Record<string, (payload: any) => any> = {
  'source:upsert': p => ({
    object: 'voyager.source',
    id: `src_${++counter}`,
    identifier: p?.identifier ?? 'default',
    name: p?.name ?? 'Default'
  }),
  'index:upsert': p => ({
    object: 'voyager.index',
    id: `idx_${++counter}`,
    identifier: p?.identifier ?? 'default',
    name: p?.name ?? 'Default',
    sourceId: p?.sourceId ?? 'src_1'
  }),
  'record:search': () => [],
  'record:index': p => ({
    object: 'voyager.record',
    id: `rec_${++counter}`,
    documentId: p?.documentId ?? 'doc',
    fields: p?.fields ?? {},
    body: p?.body ?? {},
    metadata: p?.metadata ?? {},
    hash: 'stub',
    isTenantSpecific: Array.isArray(p?.tenantIds) && p.tenantIds.length > 0,
    createdAt: new Date().toISOString()
  }),
  'record:delete': () => ({ success: true })
};

let server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    let url = new URL(req.url);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/ping')) {
      return new Response('ok', { status: 200 });
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let text = await req.text();
    let body = text ? JSON.parse(text) : {};
    let calls: RpcCall[] = body.calls ?? [];

    let results = calls.map(call => {
      let handler = handlers[call.name];
      if (!handler) {
        return {
          __typename: 'rpc.response.call',
          id: call.id,
          name: call.name,
          status: 501,
          result: { error: `unsupported RPC ${call.name}` }
        };
      }

      return {
        __typename: 'rpc.response.call',
        id: call.id,
        name: call.name,
        status: 200,
        result: handler(call.payload)
      };
    });

    return Response.json({ __typename: 'rpc.response', calls: results });
  }
});

console.log(`voyager mock listening on ${server.hostname}:${server.port}`);
