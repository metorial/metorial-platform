import { delay } from '@metorial/delay';
import { generateCustomId } from '@metorial/id';
import Dockerode from 'dockerode';
import { buildArguments } from '../args/buildArguments';
import { DockerStreamManager } from './streamManager';

export type DockerManagerOptions = Dockerode.DockerOptions & {
  registryAuth?: {
    username?: string;
    password?: string;
  };
};

let imagePulls = new Map<string, { pulledAt: Date; usedAt: Date }>();
let SKIP_PULL_TIME = 1000 * 60 * 5; // 5 minutes
let IMAGE_PRUNE_TIME = 1000 * 60 * 60 * 6; // 6 hours

export class DockerManager {
  #docker: Dockerode;
  #registryAuth: { username?: string; password?: string } | undefined;

  constructor(options?: DockerManagerOptions) {
    this.#docker = new Dockerode(options);
    this.#registryAuth = options?.registryAuth;
  }

  async stopAndRemoveContainer(container: { id: string }) {
    try {
      let cont = this.#docker.getContainer(container.id);

      await cont.stop({ t: 1 });

      try {
        await cont.remove();
      } catch (err: any) {}
    } catch (err: any) {
      if (
        err.message.includes('No such container') ||
        err.message.includes('is not running') ||
        err.message.includes('is already in progress') ||
        err.message.includes('container already stopped')
      ) {
        return;
      }

      console.warn(`Failed to stop/remove container ${container.id}:`, err);
    }
  }

  async startContainer(d: {
    image: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    onExit?: () => void;
  }) {
    try {
      let name: string = generateCustomId('metorial_').toLowerCase();

      let cmd: string[] = [
        'docker',
        'run',

        ...buildArguments({
          rm: true,
          name,
          interactive: true,
          cpus: '0.25',
          memory: '250m',
          env: Object.entries(d.env ?? {}).map(([key, value]) => `${key}=${value}`)
        }),

        d.image,

        ...[d.command, ...(d.args ?? [])].filter(Boolean)
      ];

      console.log('Starting container:', cmd.join(' '));

      let proc = Bun.spawn(cmd, {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'pipe'
      });

      proc.exited.then(() => {
        d.onExit?.();
      });

      let stdoutStream = proc.stdout;
      let stderrStream = proc.stderr;
      let stdinStream = proc.stdin;

      // await delay(100);

      for (let i = 0; i < 50; i++) {
        await delay(25);

        try {
          let container = this.#docker.getContainer(name);

          return {
            container,
            stream: new DockerStreamManager(stdinStream, stdoutStream, stderrStream)
          };
        } catch (err: any) {
          if (err.message.includes('No such container')) continue;
          throw err;
        }
      }

      throw new Error('Failed to start container');
    } catch (err) {
      console.error('Error starting container:', err);
      throw err;
    }
  }

  async pullImage(image: string, onProgress?: (progress: number) => void) {
    return new Promise<void>((resolve, reject) => {
      if (!image.includes(':')) image += ':latest';

      // if (imagePulls.has(image)) {
      //   let pull = imagePulls.get(image)!;
      //   pull.usedAt = new Date();
      //   if (pull.pulledAt.getTime() > Date.now() - SKIP_PULL_TIME) return resolve();
      // }

      this.#docker.pull(image, { authconfig: this.#registryAuth }, (err, stream) => {
        if (err || !stream) return reject(err);

        imagePulls.set(image, { pulledAt: new Date(), usedAt: new Date() });

        let downloaded = 0;
        let total = 0;

        let onProgressEvent = (event: any) => {
          console.log('Image pull progress:', event);

          if (event.progressDetail?.total) {
            downloaded += event.progressDetail.current || 0;
            total = event.progressDetail.total;

            onProgress?.(Math.min(downloaded / total, 1));
          }
        };

        let onFinished = (err: any) => {
          console.log('Image pull finished:', image, err);

          if (err) {
            imagePulls.delete(image);
            return reject(err);
          }

          console.log('Image pull finished2:', image);

          resolve();
        };

        this.#docker.modem.followProgress(stream, onFinished, onProgressEvent);
      });
    });
  }
}
