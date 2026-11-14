import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { currentContext } from './context';
import { encodeFrame, encodeJson, FrameDecoder, type Frame, type FrameError } from './frames';

let LOOKUP_TIMEOUT_MS = 30_000;

export let randomId = () => randomBytes(12).toString('hex');

export let codedError = (
  message: string,
  props: { code: string; syscall?: string; [key: string]: unknown }
) => Object.assign(new Error(message), props);

export class Control {
  #socket: net.Socket;
  #lookups = new Map<string, (frame: Frame) => void>();
  #tunnels = new Map<string, net.Socket>();
  #handlers = new Map<string, (frame: Frame) => void>();

  constructor(socket: net.Socket) {
    this.#socket = socket;

    let decoder = new FrameDecoder();
    socket.on('data', chunk => {
      let frames: Frame[];
      try {
        frames = decoder.push(chunk);
      } catch (err) {
        socket.destroy(err as Error);
        return;
      }
      for (let frame of frames) this.#dispatch(frame);
    });
  }

  on(type: string, handler: (frame: Frame) => void) {
    this.#handlers.set(type, handler);
  }

  onClose(handler: () => void) {
    this.#socket.on('close', handler);
  }

  send(frame: Frame) {
    this.#socket.write(encodeFrame(frame));
  }

  sendJson(json: string) {
    this.#socket.write(encodeJson(json));
  }

  trackTunnel(id: string, socket: net.Socket) {
    this.#tunnels.set(id, socket);
    socket.once('close', () => this.#tunnels.delete(id));
  }

  lookup(hostname: string): Promise<string[]> {
    let ctx = currentContext();
    if (!ctx || ctx.ended) {
      return Promise.reject(
        codedError(`getaddrinfo ENOTFOUND ${hostname} (no active invocation)`, {
          code: 'ENOTFOUND',
          syscall: 'getaddrinfo',
          hostname
        })
      );
    }

    let id = randomId();
    return new Promise((resolve, reject) => {
      let timer = setTimeout(() => {
        this.#lookups.delete(id);
        reject(
          codedError(`getaddrinfo ETIMEOUT ${hostname}`, {
            code: 'ETIMEOUT',
            syscall: 'getaddrinfo',
            hostname
          })
        );
      }, LOOKUP_TIMEOUT_MS);
      timer.unref();

      this.#lookups.set(id, frame => {
        clearTimeout(timer);
        if (frame.error) {
          reject(
            codedError(`getaddrinfo ${frame.error.code} ${hostname}`, {
              code: frame.error.code,
              syscall: 'getaddrinfo',
              hostname
            })
          );
        } else {
          resolve(frame.addresses ?? []);
        }
      });

      this.send({ type: 'lookup', id, requestId: ctx.requestId, hostname });
    });
  }

  #dispatch(frame: Frame) {
    if (frame.type == 'lookupResult') {
      let resolve = this.#lookups.get(frame.id!);
      this.#lookups.delete(frame.id!);
      resolve?.(frame);
      return;
    }

    if (frame.type == 'tunnelError') {
      let socket = this.#tunnels.get(frame.tunnelId!);
      if (socket) socket.destroy(tunnelError(socket, frame.error));
      return;
    }

    if (frame.type == 'tunnelReady') {
      let socket = this.#tunnels.get(frame.tunnelId!);
      (socket as any)?.[Symbol.for('metorial.tunnel')]?.established?.();
      return;
    }

    this.#handlers.get(frame.type)?.(frame);
  }
}

let tunnelError = (socket: net.Socket, error: FrameError | undefined) => {
  let target = (socket as any)[Symbol.for('metorial.tunnel')] as
    { host: string; port: number } | undefined;
  return codedError(error?.message ?? 'egress tunnel failed', {
    code: error?.code ?? 'ECONNREFUSED',
    syscall: 'connect',
    address: target?.host,
    port: target?.port,
    reason: error?.reason
  });
};
