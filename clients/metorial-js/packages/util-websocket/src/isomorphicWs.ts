import mitt from 'mitt';
import { findBrowserWs } from './findBrowserWs';

let browserWs = findBrowserWs();
let wsImplementation = browserWs ?? require('ws');

export class IsomorphicWs {
  private ws?: WebSocket;
  private emitter = mitt<{
    open: void;
    close: void;
    message: any;
  }>();
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private explicitlyClosed = false;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    if (this.explicitlyClosed) return;

    this.ws = new wsImplementation(this.url);

    this.ws!.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.emitter.emit('open');
    });

    this.ws!.addEventListener('close', () => {
      if (!this.explicitlyClosed) {
        this.reconnect();
      } else {
        this.close();
      }
    });

    this.ws!.addEventListener('message', event => this.emitter.emit('message', event.data));

    this.ws!.addEventListener('error', err => {
      console.error('[METORIAL LIVE CONNECTION ERROR]', err);
      if (!this.explicitlyClosed) {
        this.reconnect();
      }
    });
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[METORIAL LIVE] Max reconnect attempts reached');
      this.close();
      return;
    }

    this.reconnectAttempts++;
    let delay = this.reconnectDelay * this.reconnectAttempts; // Backoff strategy

    console.log(`[METORIAL LIVE] Reconnecting in ${delay / 1000} seconds...`);

    setTimeout(() => this.connect(), delay);
  }

  close() {
    this.emitter.emit('close');

    this.explicitlyClosed = true; // Mark as manually closed
    this.emitter.all.clear();
    this.ws?.close();
  }

  async send(data: string, timeout = 5000): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws?.send(data);
      return;
    }

    try {
      await this.waitForOpen(timeout);
      this.ws?.send(data);
    } catch (err) {
      console.error('[METORIAL LIVE] Failed to send message: Connection timeout');
    }
  }

  private waitForOpen(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let timer = setTimeout(() => {
        this.emitter.off('open', onOpen);
        reject(new Error('WebSocket connection timeout'));
      }, timeout);

      let onOpen = () => {
        clearTimeout(timer);
        this.emitter.off('open', onOpen);
        resolve();
      };

      this.emitter.on('open', onOpen);
    });
  }

  on(event: 'open' | 'close' | 'message', cb: (data: any) => void) {
    this.emitter.on(event, cb);
    return () => this.emitter.off(event, cb);
  }
}
