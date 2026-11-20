import { createDoctor, type CheckDefinition } from '@lowerdeck/doctor';
import { notFoundError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { createServer, Group, rpcMux } from '@lowerdeck/rpc-server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rpcDependencyCheck } from './dependency';

let run = async (checks: CheckDefinition[]) => {
  let report = await createDoctor({ component: 'test', checks }).run();
  return Object.fromEntries(report.checks.map(item => [item.id, item]));
};

let group = new Group();

let serve = (
  mux: { fetch: (request: Request) => Promise<Response> },
  path = '/metorial-test'
) =>
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    if (!new URL(url).pathname.startsWith(path)) {
      return new Response(JSON.stringify(notFoundError('route').toResponse()), {
        status: 404
      });
    }

    return mux.fetch(new Request(url, init));
  });

let check = () =>
  rpcDependencyCheck({ name: 'secret-store', endpoint: 'http://nebula:52170/metorial-test' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rpcDependencyCheck', () => {
  it('passes when the service answers rpc:ping', async () => {
    serve(rpcMux({ path: '/metorial-test' }, [createServer({})(group.controller({}))]));

    let checks = await run([check()]);
    expect(checks['dependencies.secret-store']!.status).toBe('pass');
    expect(checks['dependencies.secret-store']!.target).toBe('secret-store');
  });

  it('fails with a credentials resolution when the service rejects the request', async () => {
    serve(
      rpcMux(
        {
          path: '/metorial-test',
          authenticateRequest: async () => {
            throw new ServiceError(unauthorizedError());
          }
        },
        [createServer({})(group.controller({}))]
      )
    );

    let result = (await run([check()]))['dependencies.secret-store']!;
    expect(result.status).toBe('fail');
    expect(result.details!.errorKind).toBe('authentication');
    expect(result.resolution!.summary).toBe('The service rejected our credentials.');
  });

  it('fails when the URL points at the wrong path', async () => {
    serve(
      rpcMux({ path: '/metorial-test' }, [createServer({})(group.controller({}))]),
      '/other'
    );

    let result = (await run([check()]))['dependencies.secret-store']!;
    expect(result.status).toBe('fail');
    expect(result.message).toContain('does not point at its RPC endpoint');
  });

  it('passes for a service that predates rpc:ping', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify(notFoundError({ entity: 'handler' }).toResponse()), {
          status: 404
        })
    );

    let result = (await run([check()]))['dependencies.secret-store']!;
    expect(result.status).toBe('pass');
    expect(result.details!.ping).toBe('unsupported');
  });

  it('reports a refused connection from the transport error', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:52170'), {
          code: 'ECONNREFUSED'
        })
      });
    });

    let result = (await run([check()]))['dependencies.secret-store']!;
    expect(result.status).toBe('fail');
    expect(result.details!.errorKind).toBe('connection_refused');
    expect(result.resolution!.summary).toBe('The service is not reachable.');
  });

  it('uses the given client', async () => {
    let calls: string[] = [];
    let client = { rpc: { ping: async () => calls.push('ping') } };

    let result = (await run([rpcDependencyCheck({ name: 'cluster-manager', client })]))[
      'dependencies.cluster-manager'
    ]!;
    expect(result.status).toBe('pass');
    expect(calls).toEqual(['ping']);
  });
});
