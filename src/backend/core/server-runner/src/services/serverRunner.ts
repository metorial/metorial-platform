import { ensureServerRunner } from '@metorial/db';
import { generateCustomId } from '@metorial/id';
import { Service } from '@metorial/service';

class ServerRunnerImpl {
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
}

export let serverRunnerService = Service.create(
  'serverRunner',
  () => new ServerRunnerImpl()
).build();
