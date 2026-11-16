import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { encodeFrame, FrameDecoder, type Frame } from '../src/frames';

export let BOOTSTRAP = path.resolve(import.meta.dirname, '../dist/bootstrap.cjs');

export interface TunnelRecord {
  tunnelId: string;
  requestId: string;
  host: string;
  port: number;
  closed: Promise<void>;
}

export interface Route {
  port: number;
}

export interface InvokeResult {
  requestId: string;
  payload: any;
  logs: { stream: string; line: string }[];
}

export interface HarnessOptions {
  files: Record<string, string>;
  entrypoint?: { path: string; export?: string; kind: 'module' | 'enveloped' };
  concurrency?: 'exclusive' | 'shared';
  routes?: Record<string, Route>;
  dns?: Record<string, string[]>;
  env?: Record<string, string>;
}

// A stand-in for the Go supervisor: it speaks the control protocol on fd 3, serves tunnels
// on a unix socket and routes them to local servers by target host.
export class FakeSupervisor {
  tunnels: TunnelRecord[] = [];
  lookups: { requestId: string; hostname: string }[] = [];
  instanceOutput = '';
  crash?: Frame;

  #child!: ChildProcess;
  #control!: net.Socket;
  #server!: net.Server;
  #dir!: string;
  #pending = new Map<
    string,
    { resolve: (r: InvokeResult) => void; logs: InvokeResult['logs'] }
  >();
  #ended = new Set<string>();
  #ready!: Promise<void>;
  #exited!: Promise<number | null>;

  constructor(private options: HarnessOptions) {}

  static async start(options: HarnessOptions) {
    let harness = new FakeSupervisor(options);
    await harness.#start();
    return harness;
  }

  async #start() {
    this.#dir = await fs.mkdtemp(path.join(os.tmpdir(), 'runtime-node-'));
    let bundleDir = path.join(this.#dir, 'bundle');
    for (let [name, content] of Object.entries(this.options.files)) {
      let file = path.join(bundleDir, name);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content);
    }

    let socketPath = path.join(this.#dir, 'tunnel.sock');
    this.#server = net.createServer({ allowHalfOpen: true }, conn => this.#onTunnel(conn));
    await new Promise<void>(resolve => this.#server.listen(socketPath, resolve));

    this.#child = spawn(process.execPath, [BOOTSTRAP], {
      cwd: bundleDir,
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        ...this.options.env,
        METORIAL_SUPERVISOR_SOCKET: socketPath,
        METORIAL_CONTROL_FD: '3',
        METORIAL_BUNDLE_DIR: bundleDir,
        METORIAL_CONCURRENCY: this.options.concurrency ?? 'shared',
        METORIAL_ENTRYPOINT: JSON.stringify(
          this.options.entrypoint ?? { path: 'index.js', export: 'handler', kind: 'module' }
        )
      }
    });
    this.#child.stdout!.on('data', chunk => (this.instanceOutput += chunk));
    this.#child.stderr!.on('data', chunk => (this.instanceOutput += chunk));
    this.#exited = new Promise(resolve => this.#child.once('exit', code => resolve(code)));

    this.#control = this.#child.stdio[3] as net.Socket;
    let decoder = new FrameDecoder();
    this.#ready = new Promise((resolve, reject) => {
      this.#control.on('data', chunk => {
        for (let frame of decoder.push(chunk)) {
          if (frame.type == 'ready') resolve();
          else this.#onFrame(frame);
        }
      });
      this.#exited.then(code =>
        reject(new Error(`worker exited (${code}): ${this.instanceOutput}`))
      );
    });
    this.#ready.catch(() => {});
  }

  ready() {
    return this.#ready;
  }

  exited() {
    return this.#exited;
  }

  invoke(payload: unknown, opts: { payloadJson?: string; requestId?: string } = {}) {
    let requestId = opts.requestId ?? `req_${randomBytes(6).toString('hex')}`;
    let result = new Promise<InvokeResult>(resolve =>
      this.#pending.set(requestId, { resolve, logs: [] })
    );
    this.#control.write(
      encodeFrame({
        type: 'invoke',
        requestId,
        payload: opts.payloadJson ?? JSON.stringify(payload),
        context: { invocationId: `inv_${requestId}`, deadlineMs: Date.now() + 30_000 }
      })
    );
    return { requestId, result };
  }

  // Ends the request like the supervisor does: later tunnels are refused, open ones closed.
  end(requestId: string, opts: { cancel?: boolean } = {}) {
    this.#ended.add(requestId);
    if (opts.cancel) this.#control.write(encodeFrame({ type: 'cancel', requestId }));
    for (let tunnel of this.#open.get(requestId) ?? []) tunnel.destroy();
  }

  async close() {
    this.#child.kill('SIGKILL');
    await this.#exited;
    this.#server.close();
    await fs.rm(this.#dir, { recursive: true, force: true });
  }

  #open = new Map<string, Set<net.Socket>>();

  #onFrame(frame: Frame) {
    if (frame.type == 'result') {
      let pending = this.#pending.get(frame.requestId!);
      this.#pending.delete(frame.requestId!);
      this.end(frame.requestId!);
      pending?.resolve({
        requestId: frame.requestId!,
        payload: frame.payload,
        logs: pending.logs
      });
    } else if (frame.type == 'log') {
      this.#pending
        .get(frame.requestId!)
        ?.logs.push({ stream: frame.stream!, line: frame.line! });
    } else if (frame.type == 'lookup') {
      this.lookups.push({ requestId: frame.requestId!, hostname: frame.hostname! });
      let addresses = this.options.dns?.[frame.hostname!];
      this.#control.write(
        encodeFrame(
          this.#ended.has(frame.requestId!) || !this.#pending.has(frame.requestId!)
            ? {
                type: 'lookupResult',
                id: frame.id,
                error: { code: 'ENOTFOUND', message: 'no request' }
              }
            : { type: 'lookupResult', id: frame.id, addresses: addresses ?? [] }
        )
      );
    } else if (frame.type == 'crash') {
      this.crash = frame;
    }
  }

  #onTunnel(conn: net.Socket) {
    let decoder = new FrameDecoder();
    let onData = (chunk: Buffer) => {
      let frames: Frame[];
      try {
        frames = decoder.push(chunk, 1);
      } catch {
        conn.destroy();
        return;
      }
      if (!frames.length) return;
      conn.off('data', onData);
      conn.pause();
      this.#route(conn, frames[0]!, decoder);
    };
    conn.on('data', onData);
  }

  #route(conn: net.Socket, header: Frame, decoder: FrameDecoder) {
    let closed = new Promise<void>(resolve => conn.once('close', () => resolve()));
    this.tunnels.push({
      tunnelId: header.tunnelId!,
      requestId: header.requestId!,
      host: header.host!,
      port: header.port!,
      closed
    });

    let reject = (code: string, message: string) => {
      this.#control.write(
        encodeFrame({
          type: 'tunnelError',
          tunnelId: header.tunnelId,
          error: { code, message, status: 403, reason: 'policy' }
        })
      );
    };

    if (this.#ended.has(header.requestId!) || !this.#pending.has(header.requestId!)) {
      reject(
        'ECONNREFUSED',
        `connect ${header.host}:${header.port}: egress denied (no_request)`
      );
      return;
    }
    let route =
      this.options.routes?.[`${header.host}:${header.port}`] ??
      this.options.routes?.[header.host!];
    if (!route) {
      reject('ECONNREFUSED', `connect ${header.host}:${header.port}: egress denied (policy)`);
      return;
    }

    let open = this.#open.get(header.requestId!) ?? new Set();
    this.#open.set(header.requestId!, open);
    open.add(conn);
    conn.once('close', () => open.delete(conn));

    let upstream = net.connect({ port: route.port, host: '127.0.0.1', allowHalfOpen: true });
    upstream.once('connect', () =>
      this.#control.write(encodeFrame({ type: 'tunnelReady', tunnelId: header.tunnelId }))
    );
    let rest = decoder.rest();
    if (rest.length) upstream.write(rest);
    conn.pipe(upstream).pipe(conn);
    conn.resume();
    upstream.on('error', () => conn.destroy());
    conn.on('error', () => upstream.destroy());
    conn.once('close', () => upstream.destroy());
  }
}
