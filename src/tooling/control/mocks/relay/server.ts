type RpcCall = { id: string; name: string; payload: any };

let counter = 0;
let port = Number(process.env.PORT || 52110);

let noop = (payload: any = {}) => ({
  id: `relay_${++counter}`,
  ...payload,
  success: true
});

let handlers: Record<string, (payload: any) => any> = {
  'sender:upsert': noop,
  'emailIdentity:upsert': noop,
  'email:send': () => ({ success: true }),
  'email:get': () => ({ status: 'sent' })
};

let server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    let url = new URL(req.url);
    if (req.method === 'GET' && (url.pathname === '/ping' || url.pathname.endsWith('/ping'))) {
      return new Response('ok', { status: 200 });
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let text = await req.text();
    let body = text ? JSON.parse(text) : {};
    let calls: RpcCall[] = body.calls ?? [];

    let results = calls.map(call => {
      let handler = handlers[call.name] ?? noop;
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

console.log(`relay mock listening on ${server.hostname}:${server.port}`);
