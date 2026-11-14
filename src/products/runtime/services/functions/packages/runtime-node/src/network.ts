import dgram from 'node:dgram';
import dns from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';
import { promisify } from 'node:util';
import { currentContext } from './context';
import { codedError, randomId } from './control';
import { encodeFrame } from './frames';

export let kTunnel = Symbol.for('metorial.tunnel');

export interface NetworkControl {
  trackTunnel(id: string, socket: net.Socket): void;
  lookup(hostname: string): Promise<string[]>;
}

let original = {
  socketConnect: net.Socket.prototype.connect,
  netConnect: net.connect,
  netCreateConnection: net.createConnection,
  tlsConnect: tls.connect
};

let refused = (host: string, port: number, why: string) =>
  codedError(`connect ECONNREFUSED ${host}:${port} (${why})`, {
    code: 'ECONNREFUSED',
    syscall: 'connect',
    address: host,
    port
  });

let normalizeConnectArgs = (args: any[]): [Record<string, any>, Function | undefined] => {
  if (Array.isArray(args[0])) return [args[0][0] ?? {}, args[0][1]];

  let cb = typeof args[args.length - 1] == 'function' ? args[args.length - 1] : undefined;
  if (args[0] !== null && typeof args[0] == 'object') return [args[0], cb];
  if (typeof args[0] == 'string' && Number.isNaN(Number(args[0])))
    return [{ path: args[0] }, cb];
  return [{ port: args[0], host: typeof args[1] == 'string' ? args[1] : undefined }, cb];
};

let normalizeTlsArgs = (args: any[]): [Record<string, any>, Function | undefined] => {
  let rest = [...args];
  let cb = typeof rest[rest.length - 1] == 'function' ? rest.pop() : undefined;

  let options: Record<string, any> = {};
  if (rest[0] !== null && typeof rest[0] == 'object') return [{ ...rest[0] }, cb];
  if (typeof rest[0] == 'string' && Number.isNaN(Number(rest[0]))) {
    options.path = rest.shift();
  } else {
    options.port = rest.shift();
    if (typeof rest[0] == 'string') options.host = rest.shift();
  }
  if (rest[0] !== null && typeof rest[0] == 'object') options = { ...rest[0], ...options };
  return [options, cb];
};

let validPort = (value: unknown) => {
  let port = typeof value == 'string' && value.trim() != '' ? Number(value) : value;
  if (typeof port != 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) {
    throw codedError(`Port should be > 0 and < 65536. Received ${String(value)}.`, {
      code: 'ERR_SOCKET_BAD_PORT'
    });
  }
  return port;
};

let failSoon = (socket: net.Socket, err: Error) => {
  process.nextTick(() => socket.destroy(err));
  return socket;
};

// The unix socket to the supervisor connects at once, but the destination is only reached once
// the gateway accepts the tunnel. Holding back `connect`/`ready` until the supervisor's
// `tunnelReady` keeps connect timeouts and TLS handshakes tied to the real connection.
// Node queues writes made while connecting on a `connect` listener, so the listener created by
// writing the tunnel header still runs on the unix connect; everything else waits.
let holdConnectUntilEstablished = (socket: net.Socket) => {
  let emit = socket.emit;
  let established = false;
  let passThrough: Function[] = [];
  let held: [string | symbol, any[]][] = [];

  socket.emit = function (this: net.Socket, event: string | symbol, ...args: any[]) {
    if (!established && (event == 'connect' || event == 'ready')) {
      if (event == 'connect')
        for (let listener of passThrough.splice(0)) listener.call(socket);
      held.push([event, args]);
      return true;
    }
    return emit.call(this, event, ...args);
  } as typeof socket.emit;

  return {
    writeBeforeConnect(data: Buffer) {
      let before = new Set(socket.rawListeners('connect'));
      socket.write(data);
      passThrough.push(...socket.rawListeners('connect').filter(l => !before.has(l)));
    },

    release() {
      if (established) return;
      established = true;
      socket.emit = emit;
      for (let [event, args] of held.splice(0)) emit.call(socket, event, ...args);
    }
  };
};

let installSockets = (control: NetworkControl, socketPath: string) => {
  net.Socket.prototype.connect = function (this: net.Socket, ...args: any[]) {
    let [options, cb] = normalizeConnectArgs(args);
    if (options.path || (this as any)[kTunnel]) {
      return original.socketConnect.apply(this, args as any);
    }

    let host = String(options.host || 'localhost');
    let port = validPort(options.port);
    if (typeof cb == 'function') this.once('connect', cb as any);

    if (this instanceof tls.TLSSocket) {
      return failSoon(
        this,
        refused(host, port, 'TLS sockets must be created with tls.connect')
      );
    }

    let ctx = currentContext();
    if (!ctx) return failSoon(this, refused(host, port, 'no active invocation'));
    if (ctx.ended) return failSoon(this, refused(host, port, 'the invocation has finished'));

    let tunnelId = randomId();
    let hold = holdConnectUntilEstablished(this);
    (this as any)[kTunnel] = {
      id: tunnelId,
      requestId: ctx.requestId,
      host,
      port,
      established: hold.release
    };
    control.trackTunnel(tunnelId, this);

    (original.socketConnect as Function).call(this, { path: socketPath });
    hold.writeBeforeConnect(
      encodeFrame({ type: 'tunnel', tunnelId, requestId: ctx.requestId, host, port })
    );
    return this;
  } as typeof net.Socket.prototype.connect;

  net.connect = function connect(...args: any[]) {
    return (original.netConnect as Function).apply(net, args);
  } as typeof net.connect;
  net.createConnection = function createConnection(...args: any[]) {
    return (original.netCreateConnection as Function).apply(net, args);
  } as typeof net.createConnection;

  tls.connect = function connect(...args: any[]) {
    let [options, cb] = normalizeTlsArgs(args);
    if (options.socket || options.path) {
      return (original.tlsConnect as Function).apply(tls, args);
    }

    let host = String(options.host || 'localhost');
    let port = validPort(options.port);
    let plain = new net.Socket();
    plain.connect({ host, port });

    let secure: tls.TLSSocket = (original.tlsConnect as Function).call(
      tls,
      {
        ...options,
        host,
        port,
        socket: plain,
        servername: options.servername ?? (net.isIP(host) ? undefined : host)
      },
      cb
    );
    // TLSSocket already re-emits the wrapped socket's errors; forwarding them again would emit
    // a second, unhandled error after the caller has moved on and crash the worker.
    if (options.timeout) secure.setTimeout(options.timeout);
    return secure;
  } as typeof tls.connect;
};

let familyOf = (family: unknown) => {
  if (family === 'IPv4' || family === 4) return 4;
  if (family === 'IPv6' || family === 6) return 6;
  return 0;
};

let lookupAddresses = async (control: NetworkControl, hostname: string, options: any) => {
  let family = familyOf(options?.family);

  let literal = net.isIP(hostname);
  let addresses = literal ? [hostname] : await control.lookup(hostname);

  let entries = addresses
    .map(address => ({ address, family: net.isIP(address) }))
    .filter(entry => entry.family && (!family || entry.family == family));
  if (!entries.length) {
    throw codedError(`getaddrinfo ENOTFOUND ${hostname}`, {
      code: 'ENOTFOUND',
      syscall: 'getaddrinfo',
      hostname
    });
  }
  if (options?.order == 'ipv4first') entries.sort((a, b) => a.family - b.family);
  if (options?.order == 'ipv6first') entries.sort((a, b) => b.family - a.family);
  return entries;
};

let installDns = (control: NetworkControl) => {
  let lookup = function lookup(hostname: string, options: any, callback?: Function) {
    if (typeof options == 'function') {
      callback = options;
      options = {};
    } else if (typeof options == 'number') {
      options = { family: options };
    }
    if (typeof callback != 'function') {
      throw codedError('The "callback" argument must be of type function', {
        code: 'ERR_INVALID_ARG_TYPE'
      });
    }

    if (!hostname) {
      process.nextTick(() =>
        options?.all
          ? callback!(null, [])
          : callback!(null, null, familyOf(options?.family) || 4)
      );
      return {};
    }

    lookupAddresses(control, hostname, options).then(
      entries =>
        options?.all
          ? callback!(null, entries)
          : callback!(null, entries[0]!.address, entries[0]!.family),
      err => callback!(err)
    );
    return {};
  };

  let lookupPromise = async (hostname: string, options?: any) => {
    if (typeof options == 'number') options = { family: options };
    if (!hostname)
      return options?.all ? [] : { address: null, family: familyOf(options?.family) || 4 };

    let entries = await lookupAddresses(control, hostname, options);
    return options?.all ? entries : entries[0];
  };

  Object.defineProperty(lookup, promisify.custom, { value: lookupPromise });

  let refusedResolve = (syscall: string) =>
    codedError(`${syscall} EREFUSED (direct DNS queries are disabled, use dns.lookup)`, {
      code: 'EREFUSED',
      syscall
    });

  let resolverNames = Object.keys(dns).filter(
    name => name.startsWith('resolve') || name == 'reverse' || name == 'lookupService'
  );

  for (let name of resolverNames) {
    (dns as any)[name] = function (...args: any[]) {
      let callback = args[args.length - 1];
      let err = refusedResolve(name);
      if (typeof callback == 'function') process.nextTick(() => callback(err));
      else throw err;
    };
  }
  for (let name of Object.keys(dns.promises).filter(name => resolverNames.includes(name))) {
    (dns.promises as any)[name] = async () => {
      throw refusedResolve(name);
    };
  }

  class DeniedResolver {
    constructor() {
      for (let name of resolverNames) {
        (this as any)[name] = (...args: any[]) => (dns as any)[name](...args);
      }
    }
    cancel() {}
    setServers() {}
    getServers() {
      return [];
    }
    setLocalAddress() {}
  }
  class DeniedPromiseResolver extends DeniedResolver {
    constructor() {
      super();
      for (let name of resolverNames) {
        (this as any)[name] = async () => {
          throw refusedResolve(name);
        };
      }
    }
  }

  (dns as any).lookup = lookup;
  (dns as any).Resolver = DeniedResolver;
  (dns.promises as any).lookup = lookupPromise;
  (dns.promises as any).Resolver = DeniedPromiseResolver;
};

let installUdp = () => {
  let denied = (syscall: string) =>
    codedError(`${syscall} EACCES (UDP is not available to functions)`, {
      code: 'EACCES',
      syscall
    });

  let proto = dgram.Socket.prototype as any;
  proto.send = function (this: dgram.Socket, ...args: any[]) {
    let callback = args[args.length - 1];
    let err = denied('send');
    if (typeof callback == 'function') process.nextTick(() => callback(err));
    else process.nextTick(() => this.emit('error', err));
  };
  proto.connect = function (this: dgram.Socket, ...args: any[]) {
    let callback = args[args.length - 1];
    let err = denied('connect');
    if (typeof callback == 'function') process.nextTick(() => callback(err));
    else process.nextTick(() => this.emit('error', err));
  };
};

export let installNetwork = (control: NetworkControl, socketPath: string) => {
  installSockets(control, socketPath);
  installDns(control);
  installUdp();
};
