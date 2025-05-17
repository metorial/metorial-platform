import { debug } from '@metorial/debug';
import { Emitter } from '@metorial/emitter';
import { generatePlainId } from '@metorial/id';
import {
  jsonRpcPingRequest,
  type JSONRPCError,
  type JSONRPCMessage,
  type JSONRPCResponse,
  type Prompt,
  type ResourceTemplate,
  type Tool
} from '@metorial/mcp-utils';

export interface BrokerRunnerImplementationEvents {
  error: Error;
  message: JSONRPCMessage;
  close: void;
  ping: void;
}

let MCP_VERSION = '2024-11-05';
let PING_INTERVAL = 1000 * 15;
let PING_TIMEOUT = 1000 * 50;

let connections = new Set<BrokerRunnerImplementation>();

export abstract class BrokerRunnerImplementation {
  protected lastMessageAt: number;
  protected connectionId = generatePlainId(15);

  protected doSendPing = true;

  constructor(protected emitter: Emitter<BrokerRunnerImplementationEvents>) {
    connections.add(this);
    this.lastMessageAt = Date.now();
  }

  static createEmitter() {
    return new Emitter<BrokerRunnerImplementationEvents>();
  }

  sendPing() {
    if (!this.doSendPing) return;
    this.sendMessage(jsonRpcPingRequest(this.connectionId));
  }

  protected abstract sendMessageImpl(message: JSONRPCMessage): Promise<void>;
  protected abstract closeImpl(): Promise<void>;

  async sendMessage(message: JSONRPCMessage) {
    try {
      if ('method' in message) {
        // We need to override the protocol version since
        // we may not be using the same version as the client
        if (message.method == 'initialize') {
          message.params = {
            ...message.params,
            protocolVersion: MCP_VERSION
          };
        }
      }

      await this.sendMessageImpl(message);
    } catch (error) {
      this.emitter.emit('error', new Error('Failed to send message'));
    }
  }

  onMessage(callback: (message: JSONRPCMessage) => void) {
    return this.emitter.on('message', callback);
  }

  onError(callback: (error: Error) => void) {
    return this.emitter.on('error', callback);
  }

  onClose(callback: () => void) {
    return this.emitter.on('close', callback);
  }

  onPing(callback: () => void) {
    return this.emitter.on('ping', callback);
  }

  async sendAndWaitForResponse(message: Omit<JSONRPCMessage, 'id' | 'jsonrpc'>) {
    let msg: JSONRPCMessage = {
      ...(message as any),
      jsonrpc: '2.0',
      id: `mt/oo/${generatePlainId(15)}`
    };

    return new Promise<JSONRPCResponse>(async (resolve, reject) => {
      let unsub = this.emitter.on('message', (msg: JSONRPCMessage) => {
        if ('id' in msg && msg.id == (msg as JSONRPCResponse).id) {
          unsub();

          if ('error' in msg) {
            reject(msg as JSONRPCError);
          } else {
            resolve(msg as JSONRPCResponse);
          }
        }
      });

      await this.sendMessage(msg);
    });
  }

  async listTools() {
    let tools: Tool[] = [];

    let cursor: any | undefined = undefined;

    try {
      while (true) {
        let res: any = await this.sendAndWaitForResponse({
          method: 'tools/list',
          params: { cursor }
        });

        tools.push(...res.result.tools);
        cursor = res.result.cursor;

        if (cursor == null) break;
      }
    } catch (error) {}

    return tools;
  }

  async listPrompts() {
    let prompts: Prompt[] = [];

    let cursor: any | undefined = undefined;

    try {
      while (true) {
        let res: any = await this.sendAndWaitForResponse({
          method: 'prompts/list',
          params: { cursor }
        });

        prompts.push(...res.result.prompts);
        cursor = res.result.cursor;

        if (cursor == null) break;
      }
    } catch (error) {}

    return prompts;
  }

  async listResourceTemplates() {
    let resourceTemplates: ResourceTemplate[] = [];

    let cursor: any | undefined = undefined;

    try {
      while (true) {
        let res: any = await this.sendAndWaitForResponse({
          method: 'resource_templates/list',
          params: { cursor }
        });

        resourceTemplates.push(...res.result.resourceTemplates);
        cursor = res.result.cursor;

        if (cursor == null) break;
      }
    } catch (error) {}

    return resourceTemplates;
  }

  #isClosed = false;
  async close() {
    if (this.#isClosed) return;
    this.#isClosed = true;

    connections.delete(this);

    this.emitter.emit('close');
    this.emitter.clear();

    await this.closeImpl();
  }

  checkPing() {
    if (!this.doSendPing) return;

    let now = Date.now();
    let pingDiff = now - this.lastMessageAt;

    if (pingDiff > PING_TIMEOUT) {
      debug.warn(`Client ping timeout: ${pingDiff}ms`);
      this.close();
    }
  }
}

setInterval(() => {
  for (let con of connections.values()) con.checkPing();
}, 10 * 1000);

setInterval(() => {
  for (let con of connections.values()) con.sendPing();
}, PING_INTERVAL);
