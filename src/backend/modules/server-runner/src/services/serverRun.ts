import { db, ID, ServerDeployment, ServerRun, ServerSession } from '@metorial/db';
import { Hash } from '@metorial/hash';
import { createQueue } from '@metorial/queue';
import { Service } from '@metorial/service';

export type ServerRunCloseResult = {
  reason:
    | 'server_exited_success'
    | 'server_exited_error'
    | 'server_stopped'
    | 'server_failed_to_start'
    | 'get_launch_params_error';
  exitCode?: number;
};

let closeServerRunQueue = createQueue<{
  session: ServerSession & { serverDeployment: ServerDeployment };
  serverRun: ServerRun;
  result: ServerRunCloseResult;
}>({
  name: 'srn/run/close'
});

export let closeServerRunQueueProcessor = closeServerRunQueue.process(async d => {
  let status =
    {
      server_exited_success: 'completed' as const,
      server_exited_error: 'failed' as const,
      server_stopped: 'completed' as const,
      server_failed_to_start: 'failed' as const,
      get_launch_params_error: 'failed' as const
    }[d.result.reason] ?? ('completed' as const);

  await db.serverRun.updateMany({
    where: { oid: d.serverRun.oid },
    data: {
      status,
      stoppedAt: new Date()
    }
  });

  if (status == 'failed') {
    await db.sessionEvent.createMany({
      data: {
        id: await ID.generateId('sessionEvent'),
        type: 'error',
        sessionOid: d.session.sessionOid,
        serverRunOid: d.serverRun.oid,
        payload: {
          code: d.result.reason,
          exitCode: d.result.exitCode ?? 0
        }
      }
    });

    let errorFingerprint = await Hash.sha256(
      JSON.stringify([d.result.reason, String(d.session.serverDeployment.serverOid)])
    );

    let message =
      {
        server_exited_success: 'Server exited successfully',
        server_exited_error: 'Server exited with error',
        server_stopped: 'Server stopped',
        server_failed_to_start: 'Server failed to start',
        get_launch_params_error: 'Get launch params function failed'
      }[d.result.reason] ?? 'Unknown error';

    let group = await db.serverRunErrorGroup.upsert({
      where: {
        fingerprint_serverOid_instanceOid: {
          fingerprint: errorFingerprint,
          serverOid: d.session.serverDeployment.serverOid,
          instanceOid: d.session.instanceOid
        }
      },
      create: {
        id: await ID.generateId('serverRunErrorGroup'),
        fingerprint: errorFingerprint,
        message,
        code: d.result.reason,
        count: 1,
        serverOid: d.session.serverDeployment.serverOid,
        instanceOid: d.session.instanceOid
      },
      update: {
        count: { increment: 1 }
      }
    });

    await db.serverRunError.createMany({
      data: {
        id: await ID.generateId('serverRunError'),
        code: d.result.reason,
        message,
        metadata: {
          exitCode: d.result.exitCode ?? 0
        },
        serverDeploymentOid: d.session.serverDeployment.oid,
        serverRunErrorGroupOid: group.oid,
        serverRunOid: d.serverRun.oid,
        instanceOid: d.session.instanceOid
      }
    });
  }

  // Timeout to allow for final logs to be sent
  setTimeout(async () => {
    await db.sessionEvent.createMany({
      data: {
        id: await ID.generateId('sessionEvent'),
        type: 'server_run_stopped',
        sessionOid: d.session.sessionOid,
        serverRunOid: d.serverRun.oid
      }
    });
  }, 2500);
});

class ServerRunnerRunImpl {
  async closeServerRun(d: {
    session: ServerSession & { serverDeployment: ServerDeployment };
    serverRun: ServerRun;
    result: ServerRunCloseResult;
  }) {
    await closeServerRunQueue.add(d);
  }

  async storeServerRunLogs(d: {
    serverRun: ServerRun;
    session: ServerSession;
    lines: {
      type: 'stdout' | 'stderr';
      line: string;
    }[];
  }) {
    let lastEvent = await db.sessionEvent.findFirst({
      where: { serverRunOid: d.serverRun.oid },
      orderBy: { oid: 'desc' }
    });

    let lines = d.lines.map(l => `${l.type == 'stdout' ? 'O' : 'E'}${l.line}`);

    if (lastEvent?.type == 'server_logs') {
      await db.sessionEvent.updateMany({
        where: { oid: lastEvent.oid },
        data: {
          logLines: { push: lines }
        }
      });
    } else {
      await db.sessionEvent.createMany({
        data: {
          id: await ID.generateId('sessionEvent'),
          type: 'server_logs',
          sessionOid: d.session.sessionOid,
          serverRunOid: d.serverRun.oid,
          logLines: lines
        }
      });
    }
  }
}

export let serverRunnerRunService = Service.create(
  'serverRunnerRun',
  () => new ServerRunnerRunImpl()
).build();
