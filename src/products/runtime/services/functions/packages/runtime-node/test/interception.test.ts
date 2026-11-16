import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FakeSupervisor, type HarnessOptions } from './harness';

let CERT = path.resolve(import.meta.dirname, 'fixtures/tls.crt');
let KEY = path.resolve(import.meta.dirname, 'fixtures/tls.key');

let httpServer: http.Server;
let httpsServer: https.Server;
let echoServer: net.Server;
let tlsEchoServer: tls.Server;
let ports: Record<'http' | 'https' | 'echo' | 'tlsEcho', number>;
let connections = { http: 0, https: 0 };

let listen = (server: net.Server) =>
  new Promise<number>(resolve =>
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port))
  );

beforeAll(async () => {
  let handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ path: req.url, host: req.headers.host }));
  };
  httpServer = http.createServer(handler);
  httpServer.on('connection', () => connections.http++);
  httpsServer = https.createServer(
    { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) },
    handler
  );
  httpsServer.on('secureConnection', () => connections.https++);
  echoServer = net.createServer(socket => socket.pipe(socket));
  tlsEchoServer = tls.createServer(
    { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) },
    socket => socket.pipe(socket)
  );

  ports = {
    http: await listen(httpServer),
    https: await listen(httpsServer),
    echo: await listen(echoServer),
    tlsEcho: await listen(tlsEchoServer)
  };
});

afterAll(() => {
  for (let server of [httpServer, httpsServer, echoServer, tlsEchoServer]) {
    (server as any).closeAllConnections?.();
    server.close();
  }
});

let harnesses: FakeSupervisor[] = [];

afterEach(async () => {
  for (let harness of harnesses.splice(0)) await harness.close();
});

let start = async (handlerSource: string, options: Partial<HarnessOptions> = {}) => {
  let harness = await FakeSupervisor.start({
    files: { 'index.js': handlerSource, ...options.files },
    routes: {
      'api.test:80': { port: ports.http },
      'api.test:443': { port: ports.https },
      'secure.test:443': { port: ports.https },
      'echo.test:7': { port: ports.echo },
      'echo.test:7443': { port: ports.tlsEcho }
    },
    dns: { 'api.test': ['203.0.113.10', '2001:db8::10'] },
    env: { NODE_EXTRA_CA_CERTS: CERT },
    ...options
  });
  harnesses.push(harness);
  await harness.ready();
  return harness;
};

let getJson = `
  let http = require('node:http');
  let https = require('node:https');
  let get = (mod, url) => new Promise((resolve, reject) => {
    mod.get(url, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
  let attempt = async fn => {
    try { return { ok: await fn() }; } catch (err) { return { error: err.code ?? err.cause?.code ?? err.message, message: String(err.cause?.message ?? err.message) }; }
  };
`;

describe('egress interception', () => {
  it('tunnels http, https and fetch with the hostname unresolved', async () => {
    let harness = await start(`
      ${getJson}
      exports.handler = async () => ({
        http: await get(http, 'http://api.test/plain'),
        https: await get(https, 'https://api.test/secure'),
        fetchHttp: await (await fetch('http://api.test/fetch')).json(),
        fetchHttps: await (await fetch('https://secure.test/fetch-tls')).json()
      });
    `);

    let { requestId, result } = harness.invoke({});
    let { payload } = await result;
    expect(payload).toEqual({
      statusCode: 200,
      body: {
        result: {
          http: { path: '/plain', host: 'api.test' },
          https: { path: '/secure', host: 'api.test' },
          fetchHttp: { path: '/fetch', host: 'api.test' },
          fetchHttps: { path: '/fetch-tls', host: 'secure.test' }
        }
      }
    });

    let targets = harness.tunnels.map(t => `${t.host}:${t.port}`).sort();
    expect(targets).toEqual(['api.test:443', 'api.test:80', 'api.test:80', 'secure.test:443']);
    expect(new Set(harness.tunnels.map(t => t.requestId))).toEqual(new Set([requestId]));
    expect(harness.lookups).toEqual([]);
  });

  it('tunnels raw net and tls sockets', async () => {
    let harness = await start(`
      let net = require('node:net');
      let tls = require('node:tls');
      let roundTrip = (socket, event) => new Promise((resolve, reject) => {
        socket.once(event, () => socket.end('ping'));
        let data = '';
        socket.on('data', chunk => (data += chunk));
        socket.on('end', () => resolve(data));
        socket.on('error', reject);
      });
      exports.handler = async () => ({
        connect: await roundTrip(net.connect(7, 'echo.test'), 'connect'),
        createConnection: await roundTrip(net.createConnection({ host: 'echo.test', port: 7 }), 'connect'),
        socket: await roundTrip(new net.Socket().connect({ host: 'echo.test', port: 7 }), 'connect'),
        tls: await roundTrip(tls.connect({ host: 'echo.test', port: 7443, servername: 'api.test' }), 'secureConnect'),
        tlsPositional: await roundTrip(tls.connect(7443, 'echo.test', { servername: 'api.test' }), 'secureConnect')
      });
    `);

    let { payload } = await harness.invoke({}).result;
    expect(payload.body.result).toEqual({
      connect: 'ping',
      createConnection: 'ping',
      socket: 'ping',
      tls: 'ping',
      tlsPositional: 'ping'
    });
    expect(harness.tunnels.map(t => `${t.host}:${t.port}`)).toEqual([
      'echo.test:7',
      'echo.test:7',
      'echo.test:7',
      'echo.test:7443',
      'echo.test:7443'
    ]);
  });

  it('verifies TLS end to end against the original hostname', async () => {
    let harness = await start(`
      ${getJson}
      exports.handler = async () => ({
        wrongName: await attempt(() => get(https, { host: 'echo.test', port: 7443, path: '/' })),
        fetchWrongName: await attempt(() => fetch('https://echo.test:7443/'))
      });
    `);

    let { payload } = await harness.invoke({}).result;
    expect(payload.body.result.wrongName.error).toBe('ERR_TLS_CERT_ALTNAME_INVALID');
    expect(payload.body.result.fetchWrongName.error).toBe('ERR_TLS_CERT_ALTNAME_INVALID');
  });

  it('surfaces denied tunnels as connection errors', async () => {
    let harness = await start(`
      ${getJson}
      let net = require('node:net');
      exports.handler = async () => ({
        http: await attempt(() => get(http, 'http://denied.test/')),
        fetch: await attempt(() => fetch('https://denied.test/')),
        net: await new Promise(resolve =>
          net.connect(25, 'denied.test').on('error', err => resolve({ code: err.code, message: err.message, reason: err.reason }))
        )
      });
    `);

    let { payload } = await harness.invoke({}).result;
    let result = payload.body.result;
    expect(result.http.error).toBe('ECONNREFUSED');
    expect(result.fetch.error).toBe('ECONNREFUSED');
    expect(result.net).toEqual({
      code: 'ECONNREFUSED',
      message: 'connect denied.test:25: egress denied (policy)',
      reason: 'policy'
    });
  });

  it('never reports a denied socket as connected and survives late errors', async () => {
    let harness = await start(`
      ${getJson}
      let net = require('node:net');
      exports.handler = async () => ({
        connected: await new Promise(resolve => {
          let socket = net.connect(25, 'denied.test');
          socket.once('connect', () => resolve(true));
          socket.once('error', () => resolve(false));
        }),
        fetch: await attempt(() => fetch('https://denied.test/'))
      });
    `);

    let { payload } = await harness.invoke({}).result;
    expect(payload.body.result.connected).toBe(false);
    expect(payload.body.result.fetch.error).toBe('ECONNREFUSED');

    await new Promise(resolve => setTimeout(resolve, 300));
    expect(harness.crash).toBeUndefined();
  });

  it('resolves dns.lookup through the supervisor and refuses direct queries', async () => {
    let harness = await start(`
      let dns = require('node:dns');
      let { promisify } = require('node:util');
      exports.handler = async () => {
        let callback = await new Promise(resolve => dns.lookup('api.test', (err, address, family) => resolve({ err: err?.code, address, family })));
        let all = await new Promise(resolve => dns.lookup('api.test', { all: true }, (err, addresses) => resolve(addresses)));
        let v6 = await dns.promises.lookup('api.test', { family: 6 });
        let promisified = await promisify(dns.lookup)('api.test');
        let fromModule = await require('node:dns/promises').lookup('api.test');
        let missing = await dns.promises.lookup('missing.test').catch(err => err.code);
        let literal = await dns.promises.lookup('198.51.100.7');
        let resolve4 = await new Promise(resolve => dns.resolve4('api.test', err => resolve(err?.code)));
        let promiseResolve = await dns.promises.resolve('api.test').catch(err => err.code);
        let resolver = await new dns.promises.Resolver().resolve4('api.test').catch(err => err.code);
        return { callback, all, v6, promisified, fromModule, missing, literal, resolve4, promiseResolve, resolver };
      };
    `);

    let { requestId, result } = harness.invoke({});
    let { payload } = await result;
    expect(payload.body.result).toEqual({
      callback: { address: '203.0.113.10', family: 4 },
      all: [
        { address: '203.0.113.10', family: 4 },
        { address: '2001:db8::10', family: 6 }
      ],
      v6: { address: '2001:db8::10', family: 6 },
      promisified: { address: '203.0.113.10', family: 4 },
      fromModule: { address: '203.0.113.10', family: 4 },
      missing: 'ENOTFOUND',
      literal: { address: '198.51.100.7', family: 4 },
      resolve4: 'EREFUSED',
      promiseResolve: 'EREFUSED',
      resolver: 'EREFUSED'
    });
    expect(harness.lookups.every(l => l.requestId == requestId)).toBe(true);
    expect(harness.lookups.map(l => l.hostname)).toContain('missing.test');
  });

  it('works for ESM entrypoints that import builtins', async () => {
    let harness = await start('', {
      files: {
        'index.mjs': `
          import { request } from 'node:https';
          import { lookup } from 'node:dns/promises';
          import { globalAgent } from 'node:http';
          await new Promise(resolve => setTimeout(resolve, 1));
          export let handler = async () => {
            let address = await lookup('api.test');
            let body = await new Promise((resolve, reject) => {
              request('https://api.test/esm', res => {
                let data = '';
                res.on('data', c => (data += c));
                res.on('end', () => resolve(JSON.parse(data)));
              }).on('error', reject).end();
            });
            return { address, body, routing: globalAgent.constructor.name };
          };
        `
      },
      entrypoint: { path: 'index.mjs', export: 'handler', kind: 'module' }
    });

    let { payload } = await harness.invoke({}).result;
    expect(payload.body.result).toEqual({
      address: { address: '203.0.113.10', family: 4 },
      body: { path: '/esm', host: 'api.test' },
      routing: 'RoutingHttpAgent'
    });
  });
});

describe('per-request pools', () => {
  it('never shares pooled connections between concurrent requests', async () => {
    let harness = await start(`
      ${getJson}
      exports.handler = async ({ n }) => {
        let results = [];
        for (let i = 0; i < 3; i++) {
          results.push((await (await fetch('http://api.test/f' + n + '-' + i)).json()).path);
          results.push((await get(http, 'http://api.test/h' + n + '-' + i)).path);
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        return results;
      };
    `);

    let calls = [1, 2, 3, 4].map(n => harness.invoke({ n }));
    let results = await Promise.all(calls.map(c => c.result));
    results.forEach((r, i) => expect(r.payload.body.result).toHaveLength(6));

    for (let call of calls) {
      let own = harness.tunnels.filter(t => t.requestId == call.requestId);
      expect(own.length).toBeGreaterThanOrEqual(2);
      expect(own.length).toBeLessThanOrEqual(6);
    }
    expect(harness.tunnels.every(t => calls.some(c => c.requestId == t.requestId))).toBe(true);
  });

  it('opens fresh connections for each request and closes them when it ends', async () => {
    let harness = await start(`
      exports.handler = async () => (await (await fetch('http://api.test/keepalive')).json()).path;
    `);

    let first = harness.invoke({});
    await first.result;
    let second = harness.invoke({});
    await second.result;

    let firstTunnels = harness.tunnels.filter(t => t.requestId == first.requestId);
    let secondTunnels = harness.tunnels.filter(t => t.requestId == second.requestId);
    expect(firstTunnels).toHaveLength(1);
    expect(secondTunnels).toHaveLength(1);
    await Promise.all(firstTunnels.map(t => t.closed));
  });
});

describe('fail closed', () => {
  it('refuses connections without an invocation context in shared mode', async () => {
    let harness = await start(`
      let net = require('node:net');
      let queue = [];
      setInterval(() => {
        for (let job of queue.splice(0)) {
          net.connect(7, 'echo.test')
            .on('connect', () => job({ connected: true }))
            .on('error', err => job({ error: err.code, message: err.message }));
        }
      }, 5).unref();
      let init = new Promise(resolve =>
        net.connect(7, 'echo.test').on('error', err => resolve(err.message)).on('connect', () => resolve('connected'))
      );
      let initFetch = fetch('http://api.test/').then(() => 'ok', err => err.cause?.code);
      exports.handler = async () => ({
        init: await init,
        detached: await new Promise(resolve => queue.push(resolve)),
        initFetch: await initFetch
      });
    `);

    let { payload } = await harness.invoke({}).result;
    expect(payload.body.result.init).toContain('no active invocation');
    expect(payload.body.result.detached).toEqual({
      error: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED echo.test:7 (no active invocation)'
    });
    expect(payload.body.result.initFetch).toBe('ECONNREFUSED');
    expect(harness.tunnels).toEqual([]);
  });

  it('attributes detached connections to the in-flight request in exclusive mode', async () => {
    let harness = await start(
      `
      let net = require('node:net');
      let queue = [];
      setInterval(() => {
        for (let job of queue.splice(0)) {
          console.log('detached log line');
          let socket = net.connect(7, 'echo.test');
          socket.on('connect', () => socket.end('detached'));
          let data = '';
          socket.on('data', c => (data += c)).on('end', () => job(data)).on('error', err => job(err.code));
        }
      }, 5).unref();
      exports.handler = async () => new Promise(resolve => queue.push(resolve));
    `,
      { concurrency: 'exclusive' }
    );

    let { requestId, result } = harness.invoke({});
    let { payload, logs } = await result;
    expect(payload.body.result).toBe('detached');
    expect(harness.tunnels.map(t => t.requestId)).toEqual([requestId]);
    expect(logs).toContainEqual({ stream: 'stdout', line: 'detached log line' });
  });

  it('refuses connections made after the request ended', async () => {
    let harness = await start(`
      let net = require('node:net');
      let later;
      exports.handler = async ({ phase }) => {
        if (phase == 'first') {
          later = new Promise(resolve =>
            setTimeout(() => net.connect(7, 'echo.test').on('error', err => resolve(err.message)).on('connect', () => resolve('connected')), 100)
          );
          return 'scheduled';
        }
        return await later;
      };
    `);

    await harness.invoke({ phase: 'first' }).result;
    let { payload } = await harness.invoke({ phase: 'second' }).result;
    expect(payload.body.result).toBe(
      'connect ECONNREFUSED echo.test:7 (the invocation has finished)'
    );
  });

  it('stops cancelled requests from connecting', async () => {
    let harness = await start(`
      let net = require('node:net');
      let results = [];
      exports.handler = async ({ phase }) => {
        if (phase == 'report') return results;
        await new Promise(resolve => setTimeout(resolve, 200));
        await new Promise(resolve =>
          net.connect(7, 'echo.test').on('error', err => { results.push(err.message); resolve(); }).on('connect', resolve)
        );
        return 'late';
      };
    `);

    let slow = harness.invoke({ phase: 'slow' });
    await new Promise(resolve => setTimeout(resolve, 20));
    harness.end(slow.requestId, { cancel: true });
    await new Promise(resolve => setTimeout(resolve, 400));

    let { payload } = await harness.invoke({ phase: 'report' }).result;
    expect(payload.body.result).toEqual([
      'connect ECONNREFUSED echo.test:7 (the invocation has finished)'
    ]);
  });

  it('gives UDP, worker threads and child processes no route', async () => {
    let harness = await start(`
      let dgram = require('node:dgram');
      let { Worker } = require('node:worker_threads');
      let { execFile } = require('node:child_process');
      exports.handler = async () => {
        let udp = await new Promise(resolve => {
          let socket = dgram.createSocket('udp4');
          socket.send('x', 53, '1.1.1.1', err => { socket.close(); resolve(err?.code); });
        });
        let worker = await new Promise(resolve => {
          let w = new Worker(
            "let { parentPort } = require('node:worker_threads');" +
            "require('node:net').connect(7, 'echo.test').on('error', e => parentPort.postMessage(e.code)).on('connect', () => parentPort.postMessage('connected'));",
            { eval: true }
          );
          w.once('message', resolve);
        });
        let workerFetch = await new Promise(resolve => {
          let w = new Worker(
            "let { parentPort } = require('node:worker_threads');" +
            "fetch('http://api.test/').then(() => parentPort.postMessage('ok'), e => parentPort.postMessage(e.cause?.code));",
            { eval: true }
          );
          w.once('message', resolve);
        });
        let child = await new Promise(resolve =>
          execFile(process.execPath, ['-e', 'console.log(JSON.stringify(Object.keys(process.env).filter(k => k.startsWith("METORIAL_"))))'], (err, stdout) => resolve(JSON.parse(stdout)))
        );
        return { udp, worker, workerFetch, child };
      };
    `);

    let { payload } = await harness.invoke({}).result;
    expect(payload.body.result).toEqual({
      udp: 'EACCES',
      worker: 'ECONNREFUSED',
      workerFetch: 'ECONNREFUSED',
      child: []
    });
    expect(harness.tunnels).toEqual([]);
  });
});

describe('logs', () => {
  it('captures console and stdio writes per request and leaves instance logs on stdout', async () => {
    let harness = await start(`
      console.log('booting');
      exports.handler = async ({ n }) => {
        console.log('hello', n);
        console.error('problem', n);
        process.stdout.write('partial ');
        await new Promise(resolve => setTimeout(resolve, 10 * n));
        process.stdout.write('line ' + n + '\\nunterminated ' + n);
        console.warn({ structured: n });
        return n;
      };
    `);

    let [a, b] = await Promise.all([
      harness.invoke({ n: 1 }).result,
      harness.invoke({ n: 2 }).result
    ]);
    for (let [result, n] of [
      [a, 1],
      [b, 2]
    ] as const) {
      expect(result.logs).toEqual([
        { stream: 'stdout', line: `hello ${n}` },
        { stream: 'stderr', line: `problem ${n}` },
        { stream: 'stdout', line: `partial line ${n}` },
        { stream: 'stderr', line: `{ structured: ${n} }` },
        { stream: 'stdout', line: `unterminated ${n}` }
      ]);
    }
    expect(harness.instanceOutput).toContain('booting');
    expect(harness.instanceOutput).not.toContain('hello');
  });

  it('logs handler errors to the request like the launcher', async () => {
    let harness = await start(`exports.handler = async () => { throw new Error('kaput'); };`);
    let { payload, logs } = await harness.invoke({}).result;
    expect(payload.body.error.code).toBe('function_bay.handler_error');
    expect(logs[0]).toEqual({ stream: 'stderr', line: 'Error: kaput' });
  });
});

describe('lifecycle', () => {
  it('reports boot failures and exits', async () => {
    let harness = await FakeSupervisor.start({
      files: { 'index.js': `throw new Error('cannot initialize');` }
    });
    harnesses.push(harness);
    await expect(harness.ready()).rejects.toThrow();
    expect(await harness.exited()).toBe(1);
    expect(harness.crash).toMatchObject({
      type: 'crash',
      phase: 'boot',
      message: 'Error: cannot initialize'
    });
  });

  it('reports uncaught exceptions as runtime crashes', async () => {
    let harness = await start(
      `exports.handler = async () => { setTimeout(() => { throw new Error('async boom'); }, 1); return new Promise(() => {}); };`
    );
    harness.invoke({});
    expect(await harness.exited()).toBe(1);
    expect(harness.crash).toMatchObject({ phase: 'runtime', message: 'Error: async boom' });
  });

  it('scrubs its own configuration from process.env', async () => {
    let harness = await start(
      `exports.handler = async () => Object.keys(process.env).filter(k => k.startsWith('METORIAL_') || k == 'USER_VAR');`,
      { env: { USER_VAR: '1' } }
    );
    let { payload } = await harness.invoke({}).result;
    expect(payload.body.result).toEqual(['USER_VAR']);
  });
});
