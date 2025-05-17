import { ensureServerRunner, ServerSession } from '@metorial/db';
import { generateCustomId } from '@metorial/id';
import { Service } from '@metorial/service';
import { serverRunnerConnectionService } from './serverRunnerConnection';

class ServerRunnerImpl {
  #lastRunnerIndex = 0;

  constructor() {
    setInterval(
      () => {
        this.#lastRunnerIndex = 0;
      },
      1000 * 60 * 60
    );
  }

  async ensureHostedServerRunner(d: {
    identifier: string;
    name: string;
    description?: string;
    attributes?: any;
  }) {
    return await ensureServerRunner(
      async () => ({
        identifier: d.identifier,
        status: 'offline',
        connectionKey: generateCustomId('mt_runner', 60),
        name: d.name,
        description: d.description,
        type: 'hosted'
      }),
      { ignoreForUpdate: ['connectionKey'] }
    );
  }

  async findServerRunner(d: { session: ServerSession }) {
    let runners = await serverRunnerConnectionService.getOnlineServerRunners();

    return runners[this.#lastRunnerIndex++ % runners.length];
  }
}

export let serverRunnerService = Service.create(
  'serverRunner',
  () => new ServerRunnerImpl()
).build();
