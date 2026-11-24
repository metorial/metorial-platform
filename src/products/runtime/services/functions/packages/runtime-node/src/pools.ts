import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { currentContext, type RequestContext } from './context';
import { codedError } from './control';
import { writeInstanceLog } from './logs';

let UNDICI_GLOBAL_DISPATCHER = Symbol.for('undici.globalDispatcher.1');
let CONNECT_TIMEOUT_MS = 10_000;

let kPoolRequest = Symbol('metorial.poolRequest');

let router: unknown;
let warnedUnrestorable = false;

interface RequestPools {
  undici?: any;
  http?: http.Agent;
  https?: https.Agent;
}

let pools = new WeakMap<RequestContext, RequestPools>();

let poolsFor = (ctx: RequestContext) => {
  let entry = pools.get(ctx);
  if (!entry) {
    let created: RequestPools = {};
    entry = created;
    pools.set(ctx, created);
    ctx.onEnd(() => {
      created.undici?.destroy().catch(() => {});
      created.http?.destroy();
      created.https?.destroy();
    });
  }
  return entry;
};

let usable = () => {
  let ctx = currentContext();
  return ctx && !ctx.ended ? ctx : undefined;
};

// Node's fetch only exposes its undici Agent class through the default global dispatcher,
// which exists once fetch has run.
let loadUndiciAgent = async () => {
  await fetch('data:,').catch(() => {});
  let dispatcher = (globalThis as any)[UNDICI_GLOBAL_DISPATCHER];
  if (!dispatcher) throw new Error('could not locate the built-in undici dispatcher');
  return dispatcher.constructor as new (options?: any) => any;
};

let undiciConnector =
  (ctx: RequestContext | undefined) =>
  (
    options: {
      hostname: string;
      host?: string;
      protocol: string;
      port: string;
      servername?: string;
    },
    callback: (err: Error | null, socket: net.Socket | null) => void
  ) => {
    let port = Number(options.port) || (options.protocol == 'https:' ? 443 : 80);
    if (!ctx || ctx.ended) {
      let err = codedError(
        `connect ECONNREFUSED ${options.hostname}:${port} (no active invocation)`,
        {
          code: 'ECONNREFUSED',
          syscall: 'connect',
          address: options.hostname,
          port
        }
      );
      process.nextTick(() => callback(err, null));
      return;
    }

    let host = options.hostname.replace(/^\[(.*)\]$/, '$1');
    let socket = ctx.run(() =>
      options.protocol == 'https:'
        ? tls.connect({
            host,
            port,
            servername: options.servername || (net.isIP(host) ? undefined : host),
            ALPNProtocols: ['http/1.1']
          })
        : net.connect({ host, port })
    );
    socket.setNoDelay(true);

    let settled = false;
    let timer = setTimeout(() => {
      socket.destroy(
        codedError(`Connect Timeout Error (attempted address: ${host}:${port})`, {
          code: 'UND_ERR_CONNECT_TIMEOUT'
        })
      );
    }, CONNECT_TIMEOUT_MS);
    let done = (err: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(err, err ? null : socket);
    };

    socket
      .once(options.protocol == 'https:' ? 'secureConnect' : 'connect', () => done(null))
      .once('error', err => done(err));
  };

let installUndici = async () => {
  let Agent = await loadUndiciAgent();
  let Dispatcher = Object.getPrototypeOf(Object.getPrototypeOf(Agent.prototype)).constructor;
  let orphan = new Agent({ connect: undiciConnector(undefined) });

  class RequestRoutingDispatcher extends Dispatcher {
    #pick() {
      let ctx = usable();
      if (!ctx) return orphan;
      let entry = poolsFor(ctx);
      entry.undici ??= new Agent({ connect: undiciConnector(ctx) });
      return entry.undici;
    }

    dispatch(options: unknown, handler: unknown) {
      return this.#pick().dispatch(options, handler);
    }

    close(callback?: () => void) {
      if (callback) process.nextTick(callback);
      else return Promise.resolve();
    }

    destroy(errOrCallback?: unknown, callback?: () => void) {
      let cb = typeof errOrCallback == 'function' ? errOrCallback : callback;
      if (cb) process.nextTick(cb as () => void);
      else return Promise.resolve();
    }
  }

  router = new RequestRoutingDispatcher();
  (globalThis as any)[UNDICI_GLOBAL_DISPATCHER] = router;
};

// A function that calls undici's setGlobalDispatcher would send every request's fetch through
// one pool. Node defines the slot as writable but not configurable, so it can be put back.
export let restoreRequestRouting = () => {
  if (!router || (globalThis as any)[UNDICI_GLOBAL_DISPATCHER] === router) return;

  try {
    (globalThis as any)[UNDICI_GLOBAL_DISPATCHER] = router;
  } catch {}

  if ((globalThis as any)[UNDICI_GLOBAL_DISPATCHER] === router) {
    writeInstanceLog(
      'the function replaced the global fetch dispatcher; per-request routing was restored'
    );
  } else if (!warnedUnrestorable) {
    warnedUnrestorable = true;
    writeInstanceLog(
      'the function replaced the global fetch dispatcher and it could not be restored; fetch connections may be shared between invocations'
    );
  }
};

let installNodeAgents = () => {
  let make = <A extends http.Agent>(
    AgentClass: new (options?: any) => A,
    ctx?: RequestContext
  ) => {
    let agent = new AgentClass({ keepAlive: !!ctx });
    let createConnection = (agent as any).createConnection;
    (agent as any).createConnection = function (this: A, ...args: any[]) {
      if (!ctx) return createConnection.apply(this, args);
      return ctx.run(() => createConnection.apply(this, args));
    };
    return agent;
  };

  let orphanHttp = make(http.Agent);
  let orphanHttps = make(https.Agent);

  class RoutingHttpAgent extends http.Agent {
    addRequest(req: http.ClientRequest, options: unknown) {
      let ctx = usable();
      let agent = ctx ? (poolsFor(ctx).http ??= make(http.Agent, ctx)) : orphanHttp;
      return (agent as any).addRequest(req, options);
    }
  }
  class RoutingHttpsAgent extends https.Agent {
    addRequest(req: http.ClientRequest, options: unknown) {
      let ctx = usable();
      let agent = ctx ? (poolsFor(ctx).https ??= make(https.Agent, ctx)) : orphanHttps;
      return (agent as any).addRequest(req, options);
    }
  }

  http.globalAgent = new RoutingHttpAgent({ keepAlive: true });
  https.globalAgent = new RoutingHttpsAgent({ keepAlive: true });
};

// Agents the function creates itself keep their own pools. Adding the request to the pool key
// stops one request from picking up a socket another request opened. addRequest copies the
// options it receives, and the same copy reaches getName again when the socket is freed or
// removed, so the key is stable even when those callbacks run outside the request.
let installAgentPoolKeys = () => {
  let proto = http.Agent.prototype as any;
  let addRequest: Function = proto.addRequest;
  let getName = http.Agent.prototype.getName;

  proto.addRequest = function (
    this: http.Agent,
    req: http.ClientRequest,
    options: any,
    ...rest: any[]
  ) {
    let ctx = currentContext();
    if (ctx && options !== null && typeof options == 'object') {
      options = { ...options, [kPoolRequest]: ctx.requestId };
    }
    return addRequest.call(this, req, options, ...rest);
  };

  http.Agent.prototype.getName = function (this: http.Agent, options?: any) {
    let name = getName.call(this, options);
    let requestId = options?.[kPoolRequest];
    return requestId ? `${name}:${requestId}` : name;
  };
};

export let installPools = async () => {
  await installUndici();
  installNodeAgents();
  installAgentPoolKeys();
};
