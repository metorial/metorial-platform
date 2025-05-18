import { generateCustomId } from '@metorial/id';
import Dockerode from 'dockerode';
import { buildArguments } from '../args/buildArguments';
import { DockerContainerManager } from './containerManager';

export type DockerManagerOptions = Dockerode.DockerOptions & {
  registryAuth?: {
    username?: string;
    password?: string;
  };
};

export type DockerRunOptions = {
  image: string;
  tag?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export class DockerManager {
  #docker: Dockerode;
  #registryAuth: { username?: string; password?: string } | undefined;

  constructor(options: DockerManagerOptions) {
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

  async startContainer(d: DockerRunOptions) {
    if (d.tag) {
      let [image] = d.image.split(':');
      d.image = `${image}:${d.tag}`;
    }

    try {
      let name: string = generateCustomId('metorial_').toLowerCase();

      await this.pullImage(d.image);

      let dockerRunCommand: string[] = [
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

        [d.command, ...(d.args ?? [])]
          .filter(Boolean)
          .map(c => `"${c}"`)
          .join(' ')
      ];

      console.log('Starting container:', dockerRunCommand.join(' '));

      let proc = Bun.spawn(dockerRunCommand, {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'pipe'
      });

      return new DockerContainerManager(proc, name, this.#docker, this);
    } catch (err) {
      console.error('Error starting container:', err);
      throw err;
    }
  }

  async pullImage(image: string) {
    return new Promise<void>((resolve, reject) => {
      if (!image.includes(':')) image += ':latest';

      this.#docker.pull(image, { authconfig: this.#registryAuth }, (err, stream) => {
        if (err || !stream) return reject(err);

        let onProgressEvent = (event: any) => {
          console.log('Image pull progress:', event);
        };

        let onFinished = (err: any) => {
          if (err) return reject(err);
          resolve();
        };

        this.#docker.modem.followProgress(stream, onFinished, onProgressEvent);
      });
    });
  }
}
