import type { InitializeResult, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export type ConnectionMessage =
  | {
      type: 'mcp.message';
      data: JSONRPCMessage;
    }
  | {
      type: 'error';
      data: { code: string; message: string };
    }
  | {
      type: 'initialized';
      data: InitializeResult;
    }
  | {
      type: 'close';
      data?: undefined;
    };

let isMcpTraceEnabled = process.env.MCP_TRACE === 'true';
let mcpTraceLog = (...args: unknown[]) => {
  if (!isMcpTraceEnabled) return;
  console.log(`[${new Date().toISOString()}] [mcp-trace][messenger]`, ...args);
};

export class ConnectionMessenger {
  #listeners: ((msg: ConnectionMessage) => unknown)[] = [];

  onMessage(listener: (msg: ConnectionMessage) => unknown) {
    mcpTraceLog('listener:add', { totalBefore: this.#listeners.length });
    this.#listeners.push(listener);
    return () => {
      let index = this.#listeners.indexOf(listener);
      if (index >= 0) this.#listeners.splice(index, 1);
      mcpTraceLog('listener:remove', { totalAfter: this.#listeners.length });
    };
  }

  async sendToListeners(d: ConnectionMessage) {
    mcpTraceLog('dispatch:start', {
      type: d.type,
      listenerCount: this.#listeners.length
    });
    for (let listener of this.#listeners) {
      try {
        await listener(d);
      } catch (error) {
        console.error('Connection listener failed:', error);
      }
    }
    mcpTraceLog('dispatch:end', { type: d.type });
  }

  cleanup() {
    mcpTraceLog('cleanup', { listeners: this.#listeners.length });
    this.#listeners = [];
  }
}
