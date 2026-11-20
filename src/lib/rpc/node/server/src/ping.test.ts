import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import { expect, test, vi } from 'vitest';
import { Group } from './controller';
import { rpcMux } from './rpcMux';
import { createServer, rpcPingMethod } from './server';

let request = (body: unknown, path = '/rpc') =>
  new Request(`https://rpc.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/rpc+json' },
    body: serialize.encode(body)
  });

let pingCall = { calls: [{ id: '1', name: rpcPingMethod, payload: {} }] };

test('answers rpc:ping without running controller middleware', async () => {
  let middleware = vi.fn(async () => ({}));
  let group = new Group().use(middleware);
  let rpc = createServer({})(group.controller({ get: group.handler().do(async () => 'x') }));
  let mux = rpcMux({ path: '/rpc' }, [rpc]);

  let response = await mux.fetch(request(pingCall));
  expect(response.status).toBe(200);
  expect((serialize.decode(await response.text()) as any).calls[0].result).toEqual({
    ok: true
  });

  let direct = await mux.fetch(request({}, '/rpc/rpc:ping'));
  expect(serialize.decode(await direct.text())).toEqual({ ok: true });
  expect(middleware).not.toHaveBeenCalled();
});

test('authenticates rpc:ping like any other call', async () => {
  let group = new Group();
  let rpc = createServer({})(group.controller({}));
  let mux = rpcMux(
    {
      path: '/rpc',
      authenticateRequest: async () => {
        throw new ServiceError(unauthorizedError());
      }
    },
    [rpc]
  );

  let response = await mux.fetch(request(pingCall));
  expect(response.status).toBe(401);
});

test('keeps a controller-defined rpc:ping', async () => {
  let group = new Group();
  let rpc = createServer({})(
    group.controller({
      rpc: group.controller({ ping: group.handler().do(async () => 'custom') })
    })
  );

  expect(rpc.handlerNames.filter(name => name == rpcPingMethod)).toHaveLength(1);

  let response = await rpcMux({ path: '/rpc' }, [rpc]).fetch(request(pingCall));
  expect((serialize.decode(await response.text()) as any).calls[0].result).toBe('custom');
});
