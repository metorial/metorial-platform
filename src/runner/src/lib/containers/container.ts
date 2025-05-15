import { debug } from '@metorial/debug';
import { generatePlainId } from '@metorial/id';
import {
  jsonRpcPingRequest,
  jsonRpcPingResponse,
  type JSONRPCMessage
} from '@metorial/mcp-utils';
import mitt from 'mitt';
import { z } from 'zod';
import { ContainerManager } from '../docker/containerManager';
import { DockerManager, DockerManagerOptions } from '../docker/dockerManager';

let PING_INTERVAL = 1000 * 5;

export let mcpSessionContainerOptions = z.object({
  image: z.string(),
  tag: z.optional(z.string()),
  command: z.string(),
  env: z.optional(z.record(z.string())),
  args: z.optional(z.array(z.string()))
});

export type McpSessionContainerOptions = z.infer<typeof mcpSessionContainerOptions>;

export interface McpSessionContainerOpts {
  dockerOpts?: DockerManagerOptions;
  containerOpts: McpSessionContainerOptions;
  onPullProgress?: (progress: number) => void;
  onDebug?: (lines: string[]) => void;
  onClose?: () => void;
}

let cachedDockerManager: DockerManager | undefined;

export class McpSessionContainer {
  // Managers
  #dockerManager: DockerManager;
  #container?: ContainerManager;

  // Options
  #containerOpts: McpSessionContainerOptions;

  // State
  #lastMessageAt?: number;
  #pingInterval?: NodeJS.Timeout;
  #isClosing = false;

  // Lifecycle
  #startPromise?: Promise<void>;
  #emitter = mitt<{ message: JSONRPCMessage }>();

  // Listeners
  #onPullProgress?: (progress: number) => void;
  #onDebug?: (lines: string[]) => void;
  #onClose?: () => void;

  #connectionId = generatePlainId(15);

  constructor({
    dockerOpts,
    containerOpts,
    onPullProgress,
    onDebug,
    onClose
  }: McpSessionContainerOpts) {
    this.#dockerManager = cachedDockerManager ?? new DockerManager(dockerOpts);

    this.#containerOpts = containerOpts;
    this.#onDebug = onDebug;
    this.#onClose = onClose;
    this.#onPullProgress = progress => {
      debug.log('Pull progress:', progress);
      onPullProgress?.(progress);
    };

    this.#startPromise = this.start();
  }

  get lastMessageAt() {
    return this.#lastMessageAt;
  }

  async send(message: JSONRPCMessage | JSONRPCMessage[]) {
    await this.#startPromise;

    let messageArray = Array.isArray(message) ? message : [message];
    this.#container?.stdin(messageArray.map(m => JSON.stringify(m)));
  }

  async stop() {
    await this.#startPromise;

    this.close();

    await this.#container?.stopAndRemove();
  }

  onMessage(handler: (message: JSONRPCMessage) => void) {
    this.#emitter.on('message', handler);
    return () => this.#emitter.off('message', handler);
  }

  private close() {
    if (this.#isClosing) return;
    this.#isClosing = true;

    if (this.#pingInterval) clearInterval(this.#pingInterval);
    this.#emitter.all.clear();
    this.#onClose?.();

    this.#onClose = undefined;
    this.#onPullProgress = undefined;
    this.#onDebug = undefined;
  }

  private async start() {
    try {
      this.#container = await ContainerManager.create(this.#dockerManager, {
        ...this.#containerOpts,
        onProgress: this.#onPullProgress
      });

      console.log('Container started:');

      this.#container.onStderr(lines => this.handleOutput('stderr', lines));
      this.#container.onStdout(lines => this.handleOutput('stdout', lines));
      this.#container.onClose(() => this.close());

      this.#pingInterval = setInterval(
        () => this.send(jsonRpcPingRequest(this.#connectionId)),
        PING_INTERVAL
      );
    } catch (err: any) {
      console.error('Failed to start container:', err);

      this.close();
    }
  }

  private safeParseJson(str: string) {
    if (str && str.startsWith('{')) {
      try {
        return JSON.parse(str);
      } catch (err) {}
    }

    return null;
  }

  private async handleMessage(message: JSONRPCMessage) {
    this.#lastMessageAt = Date.now();

    if ('method' in message && 'id' in message && message.method == 'ping') {
      await this.send(jsonRpcPingResponse(message));
      return;
    }

    if ('id' in message && String(message.id).startsWith('mt/ping/')) {
      return;
    }

    this.#emitter.emit('message', message);
  }

  private async handleOutput(type: 'stdout' | 'stderr', lines: string[]) {
    for (let line of lines) {
      if (!line) continue;

      // debug.log(`[${type}] ${line}`);

      let json = this.safeParseJson(line);

      if (type == 'stdout' && json) {
        this.handleMessage(json);
      } else {
        this.#onDebug?.([line]);
      }
    }
  }
}
