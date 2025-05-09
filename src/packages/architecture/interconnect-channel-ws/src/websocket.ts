// Highly inspired by https://github.com/lukeed/sockette/blob/master/src/index.js

interface ReconnectingWebSocketOptions {
  protocols?: string | string[];
  maxAttempts?: number;
  timeout?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: ErrorEvent) => void;
  onMessage?: (event: MessageEvent) => void;
  onReconnect?: (event: Event) => void;
  onMaximum?: (event: Event) => void;
}

export class ReconnectingWebSocketClient {
  private ws!: WebSocket;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;
  private readonly opts: ReconnectingWebSocketOptions;
  private readonly maxAttempts: number;

  constructor(url: string, opts: ReconnectingWebSocketOptions = {}) {
    this.url = url;
    this.opts = opts;
    this.maxAttempts = opts.maxAttempts ?? Infinity;

    this.open();
  }

  private open(): void {
    this.ws = new WebSocket(this.url, this.opts.protocols ?? []);

    this.ws.addEventListener('open', event => {
      this.opts.onOpen?.(event);
      this.attempts = 0;
    });

    this.ws.addEventListener('close', event => {
      let shouldReconnect = ![1000, 1001, 1005].includes(event.code);
      if (shouldReconnect) {
        this.reconnect(event);
      }

      this.opts.onClose?.(event);
    });

    this.ws.addEventListener('error', event => {
      let error = event as any;
      if (error?.code === 'ECONNREFUSED') {
        this.reconnect(event);
      } else {
        this.opts.onError?.(event as ErrorEvent);
      }
    });

    this.ws.addEventListener('message', event => {
      this.opts.onMessage?.(event);
    });
  }

  private reconnect(event: Event): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (this.attempts++ < this.maxAttempts) {
      this.timer = setTimeout(() => {
        this.opts.onReconnect?.(event);
        this.open();
      }, this.opts.timeout ?? 1000);
    } else {
      this.opts.onMaximum?.(event);
    }
  }

  send(data: string | ArrayBufferLike): void {
    this.ws.send(data);
  }

  close(code: number = 1000, reason?: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.ws.close(code, reason);
  }
}
