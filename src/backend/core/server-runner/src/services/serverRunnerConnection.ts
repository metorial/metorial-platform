import { db, ServerRunner, ServerRunnerAttribute } from '@metorial/db';
import { badRequestError, ServiceError, unauthorizedError } from '@metorial/error';
import { Service } from '@metorial/service';

class ServerRunnerConnectionImpl {
  async registerServerRunner(d: { connectionKey: string }) {
    let runner = await db.serverRunner.findFirst({
      where: { connectionKey: d.connectionKey }
    });
    if (!runner) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Server runner not registered'
        })
      );
    }

    if (runner.status === 'online') {
      throw new ServiceError(
        badRequestError({
          message: 'Server runner already registered'
        })
      );
    }

    await db.serverRunner.updateMany({
      where: { oid: runner.oid },
      data: {
        lastSeenAt: new Date(),
        status: 'online'
      }
    });

    return runner;
  }

  async setServerRunnerConfig(d: {
    runner: ServerRunner;
    input: {
      attributes: ServerRunnerAttribute[];
      tags: string[];
      maxConcurrentJobs: number;
      version: string;
    };
  }) {
    await db.serverRunner.updateMany({
      where: { oid: d.runner.oid },
      data: {
        lastSeenAt: new Date(),
        status: 'online',
        attributes: d.input.attributes,
        tags: d.input.tags,
        maxConcurrentJobs: d.input.maxConcurrentJobs,
        runnerVersion: d.input.version
      }
    });
  }

  async unregisterServerRunner(d: { runner: ServerRunner }) {
    await db.serverRunner.updateMany({
      where: { oid: d.runner.oid },
      data: {
        lastSeenAt: new Date(),
        status: 'offline'
      }
    });
  }

  async handleServerRunnerPing(d: { runner: ServerRunner }) {
    await db.serverRunner.updateMany({
      where: { oid: d.runner.oid },
      data: { lastSeenAt: new Date() }
    });
  }
}

export let serverRunnerConnectionService = Service.create(
  'serverRunnerConnection',
  () => new ServerRunnerConnectionImpl()
).build();
