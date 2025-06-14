import { createCachedFunction, createLocallyCachedFunction } from '@metorial/cache';
import { db, ServerRunner, ServerRunnerAttribute } from '@metorial/db';
import { badRequestError, ServiceError, unauthorizedError } from '@metorial/error';
import { Service } from '@metorial/service';

let runnersCachedRemote = createCachedFunction({
  name: 'srn/runners',
  ttlSeconds: 60 * 5,
  getHash: (i: void) => '',
  provider: async () =>
    db.serverRunner.findMany({
      where: { status: 'online' },
      orderBy: { id: 'asc' }
    })
});

let runnersCachedLocal = createLocallyCachedFunction({
  getHash: (i: void) => '',
  ttlSeconds: 5,
  provider: async () => runnersCachedRemote()
});

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

    await runnersCachedRemote.clear();

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

    await runnersCachedRemote.clear();
  }

  async unregisterServerRunner(d: { runner: ServerRunner }) {
    console.log('Unregistering server runner', d.runner.id);

    await db.serverRunner.updateMany({
      where: { oid: d.runner.oid },
      data: {
        lastSeenAt: new Date(),
        status: 'offline'
      }
    });

    await runnersCachedRemote.clear();
  }

  async handleServerRunnerPing(d: { runner: ServerRunner }) {
    await db.serverRunner.updateMany({
      where: { oid: d.runner.oid },
      data: { lastSeenAt: new Date() }
    });
  }

  async getOnlineServerRunners() {
    return await runnersCachedLocal();
  }
}

export let serverRunnerConnectionService = Service.create(
  'serverRunnerConnection',
  () => new ServerRunnerConnectionImpl()
).build();
