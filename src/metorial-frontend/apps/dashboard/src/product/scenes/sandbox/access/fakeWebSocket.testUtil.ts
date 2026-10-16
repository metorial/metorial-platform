type Listener = (event: any) => void;

export class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  static reset() {
    FakeWebSocket.instances = [];
  }

  static last() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;
  }

  readyState = 0;
  binaryType = 'blob';
  bufferedAmount = 0;
  sent: (string | Uint8Array)[] = [];
  closedWith: { code?: number; reason?: string } | null = null;

  private listeners = new Map<string, Set<Listener>>();

  url: string;
  protocols: string[];

  constructor(url: string, protocols: string[]) {
    this.url = url;
    this.protocols = protocols;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string | Uint8Array) {
    if (this.readyState != 1) throw new Error('socket is not open');
    this.sent.push(typeof data == 'string' ? data : new Uint8Array(data));
  }

  close(code?: number, reason?: string) {
    if (this.closedWith) return;
    this.closedWith = { code, reason };
    this.readyState = 3;
  }

  sentJson() {
    return this.sent.filter((d): d is string => typeof d == 'string').map(d => JSON.parse(d));
  }

  sentBinary() {
    return this.sent.filter((d): d is Uint8Array => typeof d != 'string');
  }

  serverOpen() {
    this.readyState = 1;
    this.emit('open', {});
  }

  serverSend(data: string | object | Uint8Array) {
    if (data instanceof Uint8Array) {
      let copy = data.slice();
      this.emit('message', { data: copy.buffer });
    } else {
      this.emit('message', { data: typeof data == 'string' ? data : JSON.stringify(data) });
    }
  }

  serverClose(code: number, reason = '') {
    this.readyState = 3;
    this.emit('close', { code, reason, wasClean: code == 1000 });
  }

  private emit(type: string, event: any) {
    for (let listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

export let createFakeWebSocket = (url: string, protocols: string[]) =>
  new FakeWebSocket(url, protocols) as unknown as WebSocket;

export let flushPromises = async (times = 5) => {
  for (let i = 0; i < times; i++) await Promise.resolve();
};
