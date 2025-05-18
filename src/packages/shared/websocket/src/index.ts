import { Emitter } from '@metorial/emitter';

// Highly inspired by https://github.com/lukeed/sockette/blob/master/src/index.js

interface ReconnectingWebSocketOptions {
  protocols?: string | string[];
  maxAttempts?: number;
  timeout?: number;

  onReconnect?: (event: Event) => void;
}

export class ReconnectingWebSocketClient {
  private ws!: WebSocket;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;
  private readonly opts: ReconnectingWebSocketOptions;
  private readonly maxAttempts: number;
  private emitter = new Emitter<any>();

  constructor(url: string, opts: ReconnectingWebSocketOptions = {}) {
    this.url = url;
    this.opts = opts;
    this.maxAttempts = opts.maxAttempts ?? Infinity;

    this.open();
  }

  private open(): void {
    this.ws = new WebSocket(this.url, this.opts.protocols ?? []);

    this.ws.addEventListener('open', event => {
      this.attempts = 0;
      this.emitter.emit('open', event);
    });

    this.ws.addEventListener('close', event => {
      // let shouldReconnect = ![1000, 1001, 1005].includes(event.code);
      // if (shouldReconnect) {
      this.reconnect(event);
      // } else {
      //   this.emitter.emit('close', event);
      // }
    });

    this.ws.addEventListener('error', event => {
      let error = event as any;
      if (error?.code === 'ECONNREFUSED') {
        this.reconnect(event);
      } else {
        this.emitter.emit('error', event);
      }
    });

    this.ws.addEventListener('message', event => {
      this.emitter.emit('message', event);
    });
  }

  private reconnect(event: Event): void {
    if (this.timer) clearTimeout(this.timer);

    if (this.attempts++ < this.maxAttempts) {
      this.timer = setTimeout(() => {
        this.opts.onReconnect?.(event);
        this.open();
      }, this.opts.timeout ?? 1000);
    } else {
      this.emitter.emit('maximum', event);
      this.emitter.emit('close', event);
      this.emitter.clear();
    }
  }

  send(data: string | ArrayBufferLike): void {
    this.ws.send(data);
  }

  close(code: number = 1000, reason?: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.emitter.clear();
    this.ws.close(code, reason);
  }

  addEventListener(event: string, callback: (data: any) => void) {
    return this.emitter.on(event, callback);
  }

  get readyState() {
    return this.ws.readyState;
  }
}
