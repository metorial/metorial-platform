import { delay } from '@metorial/delay';
import { Emitter } from '@metorial/emitter';
import Dockerode from 'dockerode';
import { DockerManager } from './dockerManager';
import { DockerStreamManager } from './streamManager';

export type CloseEventPayload =
  | {
      reason: 'server_exited_success' | 'server_exited_error' | 'server_stopped';
      exitCode: number;
    }
  | {
      reason: 'server_failed_to_start';
    };

export class DockerContainerManager {
  #stream: DockerStreamManager;
  #emitter = new Emitter<{
    close: CloseEventPayload;
  }>();

  #stoppedContainer = false;
  #waitForContainerPromise: Promise<void>;

  #container?: Dockerode.Container;

  constructor(
    private proc: Bun.Subprocess<'pipe', 'pipe', 'pipe'>,
    private containerName: string,
    private docker: Dockerode,
    private manager: DockerManager
  ) {
    this.#stream = new DockerStreamManager(proc.stdin, proc.stdout, proc.stderr);

    let startedAt = Date.now();

    proc.exited.then(() => {
      this.#emitter.emit('close', {
        reason: this.#stoppedContainer
          ? 'server_stopped'
          : Date.now() - startedAt < 2500 || proc.exitCode != 0
            ? 'server_exited_error'
            : 'server_exited_success',
        exitCode: proc.exitCode ?? 0
      });
    });

    this.onClose(() => this.cleanup());

    this.#waitForContainerPromise = this.waitForContainer();
  }

  private async waitForContainer() {
    for (let i = 0; i < 50; i++) {
      await delay(25);

      try {
        this.#container = this.docker.getContainer(this.containerName);
        return;
      } catch (err: any) {
        if (err.message.toLowerCase().includes('no such container')) continue;
        throw err;
      }
    }

    this.#emitter.emit('close', { reason: 'server_failed_to_start' });
  }

  private async awaitContainer() {
    if (this.#container) return this.#container;
    await this.#waitForContainerPromise;
    return this.#container;
  }

  get waitForStart() {
    return this.#waitForContainerPromise;
  }

  #isStopped = false;
  async stopAndRemove() {
    if (this.#isStopped) return;
    this.#isStopped = true;

    let container = await this.awaitContainer();
    if (!container) return;

    await this.manager.stopAndRemoveContainer(container);
  }

  async stdin(message: string | string[]) {
    return this.#stream.stdin(Array.isArray(message) ? message : [message]);
  }

  onStdout(callback: (data: string[]) => void) {
    return this.#stream.onStdout(callback);
  }

  onStderr(callback: (data: string[]) => void) {
    return this.#stream.onStderr(callback);
  }

  onClose(callback: (d: CloseEventPayload) => void) {
    this.#emitter.on('close', callback);
  }

  #isClosed = false;
  private async cleanup() {
    if (this.#isClosed) return;
    this.#isClosed = true;

    this.#emitter.clear();
  }
}
