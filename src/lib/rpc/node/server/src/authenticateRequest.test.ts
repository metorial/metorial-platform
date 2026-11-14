import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import { expect, test, vi } from 'vitest';
import { Group } from './controller';
import { rpcMux } from './rpcMux';
import { createServer } from './server';

let request = (body: string) =>
  new Request('https://rpc.test/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/rpc+json' },
    body
  });

test('authenticates the raw batch once and forwards context to all calls', async () => {
  let group = new Group<{ employee: string }>();
  let handler = vi.fn(async (ctx: any) => ctx.employee);
  let rpc = createServer({})(group.controller({ ping: group.handler().do(handler) }));
  let body = serialize.encode({
    calls: [
      { id: '1', name: 'ping', payload: {} },
      { id: '2', name: 'ping', payload: {} }
    ]
  });
  let authenticateRequest = vi.fn(async ({ rawBody }) => {
    expect(rawBody).toBe(body);
    return { employee: 'adm_test' };
  });
  let mux = rpcMux({ path: '/rpc', authenticateRequest, captureRequestBody: false }, [rpc]);
  let response = await mux.fetch(request(body));
  expect(response.status).toBe(200);
  expect(
    (serialize.decode(await response.text()) as any).calls.map((call: any) => call.result)
  ).toEqual(['adm_test', 'adm_test']);
  expect(authenticateRequest).toHaveBeenCalledOnce();
});

test('rejects before decoding invalid JSON or dispatching calls, using serialized errors', async () => {
  let handler = vi.fn(async () => 'ok');
  let group = new Group();
  let rpc = createServer({})(group.controller({ ping: group.handler().do(handler) }));
  let authenticateRequest = vi.fn(async () => {
    throw new ServiceError(unauthorizedError());
  });
  let mux = rpcMux({ path: '/rpc', authenticateRequest }, [rpc]);
  let response = await mux.fetch(request('invalid JSON'));
  expect(response.status).toBe(401);
  expect((serialize.decode(await response.text()) as any).code).toBe('unauthorized');
  expect(handler).not.toHaveBeenCalled();
  expect(() =>
    rpcMux({ path: '/rpc', authenticateRequest, getSignatureToken: () => 'secret' }, [rpc])
  ).toThrow('Choose one');
});

test('fails closed with a serialized server error when authentication dependencies fail', async () => {
  let mux = rpcMux(
    {
      path: '/rpc',
      authenticateRequest: async () => {
        throw new Error('db unavailable');
      }
    },
    []
  );
  let response = await mux.fetch(request('{}'));
  expect(response.status).toBe(500);
  expect((serialize.decode(await response.text()) as any).code).toBe('internal_server_error');
});
