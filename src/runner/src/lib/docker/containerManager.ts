import { delay } from '@metorial/delay';
import { Container } from 'dockerode';
import mitt from 'mitt';
import type { DockerManager } from './dockerManager';
import { DockerStreamManager } from './streamManager';

export class ContainerManager {
  #emitter = mitt<{ close: void }>();

  private constructor(
    private docker: DockerManager,
    private container: Container,
    private stream: DockerStreamManager
  ) {
    container.wait().then(() => this.close());
  }

  static async create(
    docker: DockerManager,
    opts: {
      image: string;
      command: string;
      args?: string[];
      environment?: Record<string, string>;
      onProgress?: (progress: number) => void;
    }
  ) {
    await Promise.race([docker.pullImage(opts.image, opts.onProgress), delay(1000 * 30)]);
    console.log('Image pulled:', opts.image);

    let containerRes = await docker.startContainer(opts);
    console.log('Container started:', containerRes.container.id);

    return new ContainerManager(docker, containerRes.container, containerRes.stream);
  }

  async stopAndRemove() {
    await this.docker.stopAndRemoveContainer(this.container);
  }

  async stdin(message: string | string[]) {
    return this.stream.stdin(Array.isArray(message) ? message : [message]);
  }

  onStdout(callback: (data: string[]) => void) {
    return this.stream.onStdout(callback);
  }

  onStderr(callback: (data: string[]) => void) {
    return this.stream.onStderr(callback);
  }

  onClose(callback: () => void) {
    this.#emitter.on('close', callback);
  }

  private async close() {
    this.#emitter.emit('close');
    this.#emitter.all.clear();
  }
}
