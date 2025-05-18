import { debug } from '@metorial/debug';
import { Emitter } from '@metorial/emitter';
import { JSONRPCMessage, jsonRpcPingRequest, jsonRpcPingResponse } from '@metorial/mcp-utils';
import { ProgrammablePromise } from '@metorial/programmable-promise';
import { CloseEventPayload, DockerContainerManager } from '../docker/containerManager';
import {
  DockerManager,
  DockerManagerOptions,
  DockerRunOptions
} from '../docker/dockerManager';

export interface McpSessionOpts {
  dockerOpts: DockerManagerOptions;
  containerOpts: DockerRunOptions;
}

let dockerManager: DockerManager | undefined;

let PING_INTERVAL = 1000 * 15;
let PING_TIMEOUT = 1000 * 5;

export class McpSession {
  #container: Promise<DockerContainerManager>;
  #emitter = new Emitter<{
    message: JSONRPCMessage;
    close: CloseEventPayload;
  }>();

  #lastClientMessageAt: number = 0;
  #lastServerMessageAt: number = 0;

  #pingInterval: NodeJS.Timer | undefined;

  #onClosePromise = new ProgrammablePromise<void>();

  constructor(
    private readonly id: string,
    private readonly opts: McpSessionOpts
  ) {
    if (!dockerManager) dockerManager = new DockerManager(opts.dockerOpts);
    this.#container = dockerManager.startContainer(opts.containerOpts);

    this.#container.then(c => {
      c.onStdout(lines => this.handleOutput('stdout', lines));
      c.onStderr(lines => this.handleOutput('stderr', lines));

      c.onClose(d => {
        this.#emitter.emit('close', d);
        this.dispose();
      });

      this.#lastClientMessageAt = Date.now();
      this.#lastServerMessageAt = Date.now();

      c.waitForStart.then(() => {
        this.ping();
        this.#pingInterval = setInterval(() => this.ping(), PING_INTERVAL);
      });
    });
  }

  get waitingForClose() {
    return this.#onClosePromise.promise;
  }

  get waitForStart() {
    return this.awaitContainer();
  }

  #isStopped = false;
  async stop() {
    if (this.#isStopped) return;
    this.#isStopped = true;

    let container = await this.awaitContainer();
    await container.stopAndRemove();
  }

  async incomingMessage(messages: JSONRPCMessage[]) {
    this.#lastClientMessageAt = Date.now();

    let productiveMessages: JSONRPCMessage[] = [];

    for (let message of messages) {
      if ('method' in message && 'id' in message && message.method == 'ping') {
        await this.sendToClient(jsonRpcPingResponse(message));
        return;
      }

      if ('id' in message && String(message.id).startsWith('mt/ping/')) {
        return;
      }

      productiveMessages.push(message);
    }

    this.sendToServer(productiveMessages);
  }

  async onOutgoingMessage(handler: (message: JSONRPCMessage) => void) {
    return this.#emitter.on('message', handler);
  }

  onClose(handler: (data: CloseEventPayload) => void) {
    return this.#emitter.on('close', handler);
  }

  #isDisposed = false;
  private dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;

    clearInterval(this.#pingInterval);

    this.#emitter.clear();
    this.stop();
    this.#container = Promise.resolve({} as any);

    this.#onClosePromise.resolve();
  }

  private ping() {
    // Send pings
    this.sendToServer(jsonRpcPingRequest(this.id));
    this.sendToClient(jsonRpcPingRequest(this.id));

    // Check if we are still alive
    let now = Date.now();
    if (now - this.#lastClientMessageAt > PING_INTERVAL) {
      debug.log('RUNNER MCP ping - client not responding');
      this.stop();
    } else if (now - this.#lastServerMessageAt > PING_TIMEOUT) {
      debug.log('RUNNER MCP ping - server not responding');
      this.stop();
    }
  }

  private async awaitContainer() {
    let container = await this.#container;
    await container.waitForStart;
    return container;
  }

  private safeParseJson(str: string) {
    if (str && str.startsWith('{')) {
      try {
        return JSON.parse(str);
      } catch (err) {}
    }

    return null;
  }

  private async sendToClient(message: JSONRPCMessage | JSONRPCMessage[]) {
    let messageArray = Array.isArray(message) ? message : [message];

    for (let msg of messageArray) {
      debug.log('RUNNER MCP message - to client', msg);
      this.#emitter.emit('message', msg);
    }
  }

  private async sendToServer(message: JSONRPCMessage | JSONRPCMessage[]) {
    let container = await this.awaitContainer();

    let messageArray = Array.isArray(message) ? message : [message];

    for (let msg of messageArray) {
      debug.log('RUNNER MCP message - to server', msg);
      await container.stdin(JSON.stringify(msg));
    }
  }

  private async handleOutputMessage(message: JSONRPCMessage) {
    this.#lastServerMessageAt = Date.now();

    if ('method' in message && 'id' in message && message.method == 'ping') {
      await this.sendToServer(jsonRpcPingResponse(message));
      return;
    }

    if ('id' in message && String(message.id).startsWith('mt/ping/')) {
      return;
    }

    this.sendToClient(message);
  }

  private async handleOutput(type: 'stdout' | 'stderr', lines: string[]) {
    for (let line of lines) {
      if (!line) continue;

      // debug.log(`[${type}] ${line}`);

      let json = this.safeParseJson(line);

      if (type == 'stdout' && json) {
        this.handleOutputMessage(json);
      } else {
        console.log(`[${type}] ${line}`);
        // this.#onDebug?.([line]);
      }
    }
  }
}
