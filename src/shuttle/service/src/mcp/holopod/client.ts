import axios from 'axios';
import { EventEmitter } from 'events';
import * as https from 'https';
import { env } from '../../env';
import {
  ContainerState,
  type HealthResponse,
  type RunRequest,
  type RunResponse
} from './types';

type WsEvent =
  | { type: 'created'; containerId: string; state: ContainerState }
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'message'; data: unknown }
  | { type: 'error'; error: string }
  | { type: 'exit'; exitCode: number; timestamp: string };

let isWsDebugEnabled =
  process.env.HOLOPOD_WS_DEBUG === 'true' || process.env.MCP_TRACE === 'true';
let wsDebugLog = (...args: unknown[]) => {
  if (!isWsDebugEnabled) return;
  console.log(`[${new Date().toISOString()}] [holopod-ws-debug]`, ...args);
};

let createRunWsUrl = () => {
  let base = new URL(env.holopod.HOLOPOD_HTTP_ENDPOINT);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = '/v1/run';
  base.search = '';
  base.hash = '';
  return base.toString();
};

let createHealthUrl = () => {
  let base = new URL(env.holopod.HOLOPOD_HTTP_ENDPOINT);
  base.pathname = '/v1/health';
  base.search = '';
  base.hash = '';
  return base.toString();
};

let createHolopodConnection = (url: string) => {
  let previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    return new WebSocket(url);
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
    }
  }
};

export class HolopodRunStream extends EventEmitter {
  readonly #ws: WebSocket;
  readonly #pending: string[] = [];
  #isOpen = false;
  #isClosed = false;

  constructor() {
    super();

    let runWsUrl = createRunWsUrl();
    wsDebugLog('connect:start', { url: runWsUrl });

    this.#ws = createHolopodConnection(runWsUrl);

    this.#ws.addEventListener('open', () => {
      wsDebugLog('connect:open');
      this.#isOpen = true;
      for (let msg of this.#pending.splice(0)) {
        this.#ws.send(msg);
      }
    });

    this.#ws.addEventListener('message', event => {
      try {
        let text: string;
        if (typeof event.data === 'string') {
          text = event.data;
        } else if (event.data instanceof ArrayBuffer) {
          text = Buffer.from(event.data).toString('utf-8');
        } else {
          text = String(event.data);
        }

        let parsed = JSON.parse(text) as WsEvent;
        let runResponse = this.#toRunResponse(parsed);
        if (runResponse) this.emit('data', runResponse);
      } catch (err) {
        this.emit('error', err);
      }
    });

    this.#ws.addEventListener('error', () => {
      let err = new Error('Holopod websocket error');
      wsDebugLog('connect:error', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      this.emit('error', err);
    });
    this.#ws.addEventListener('close', event => {
      wsDebugLog('connect:close', {
        code: event.code,
        reason: event.reason
      });
      this.#isClosed = true;
      this.emit('end');
    });
  }

  write(req: RunRequest) {
    if (this.#isClosed) return false;

    let payload = this.#toWsPayload(req);
    if (!payload) return true;

    let json = JSON.stringify(payload);
    if (this.#isOpen) {
      wsDebugLog('send:direct', { size: json.length, type: payload.type });
      this.#ws.send(json);
      return true;
    }

    wsDebugLog('send:queued', { size: json.length, type: payload.type });
    this.#pending.push(json);
    return true;
  }

  end() {
    if (this.#isClosed) return;
    this.#isClosed = true;
    this.#ws.close();
  }

  #toWsPayload(req: RunRequest): Record<string, unknown> | null {
    if (req.create?.config) {
      return {
        type: 'create',
        create: {
          containerId: req.create.containerId,
          config: req.create.config
        }
      };
    }
    if (req.stdin) {
      return { type: 'stdin', stdin: req.stdin.toString('utf-8') };
    }
    if (req.closeStdin) {
      return { type: 'close_stdin' };
    }
    if (req.heartbeat) {
      return { type: 'heartbeat' };
    }
    if (req.terminate) {
      return {
        type: 'terminate',
        force: req.terminate.force,
        timeoutSecs: req.terminate.timeoutSecs
      };
    }

    return null;
  }

  #toRunResponse(msg: WsEvent): RunResponse | null {
    if (msg.type === 'created') {
      return {
        containerId: msg.containerId,
        created: {
          containerId: msg.containerId,
          state: msg.state
        }
      };
    }
    if (msg.type === 'stdout') {
      return {
        containerId: '',
        stdout: Buffer.from(msg.data, 'utf-8')
      };
    }
    if (msg.type === 'stderr') {
      return {
        containerId: '',
        stderr: Buffer.from(msg.data, 'utf-8')
      };
    }
    if (msg.type === 'message') {
      return {
        containerId: '',
        message: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data)
      };
    }
    if (msg.type === 'error') {
      return {
        containerId: '',
        error: msg.error
      };
    }
    if (msg.type === 'exit') {
      return {
        containerId: '',
        exit: {
          exitCode: msg.exitCode,
          timestamp: msg.timestamp
        }
      };
    }

    return null;
  }
}

class HolopodSessionClient {
  run() {
    return new HolopodRunStream();
  }

  close() {
    // no-op for HTTP/WebSocket transport
  }
}

export let createSessionClient = () => new HolopodSessionClient();

export let checkHolopodHealth = async (opts?: { timeoutMs?: number }) => {
  let timeoutMs = opts?.timeoutMs ?? 3000;

  let response = await axios.get<HealthResponse>(createHealthUrl(), {
    timeout: timeoutMs,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  });

  return response.data;
};

// (async () => {
//   if (process.env.NODE_ENV !== 'production') return;

//   let interval = 1000 * 30;

//   while (true) {
//     try {
//       let health = await checkHolopodHealth({ timeoutMs: 5000 });
//       console.log(`[${new Date().toISOString()}] Holopod health:`, JSON.stringify(health));

//       interval = 1000 * 60 * 5;
//     } catch (err) {
//       console.error(`[${new Date().toISOString()}] Holopod health check failed:`, err);
//     }

//     await delay(interval);
//   }
// })();
