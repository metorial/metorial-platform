import { db, ID, ServerRun } from '@metorial/db';
import { EngineRunStatus, McpOutput_McpOutputType } from '@metorial/mcp-engine-generated';
import { QueueRetryError } from '@metorial/queue';
import { UnifiedID } from '@metorial/unified-id';
import { subSeconds } from 'date-fns';
import Long from 'long';
import { getRandomClient } from '../client';
import { createServerError } from '../data/error';
import { createSessionMessage } from '../data/message';
import { engineMcpMessageFromPb } from '../mcp/message';

let minTime = new Date(2025, 0, 1);

export let syncEngineRun = async (d: { engineRunId: string }) => {
  let engineRun = await db.engineRun.findUnique({
    where: { id: d.engineRunId },
    include: {
      serverSession: { include: { serverDeployment: true, instance: true } },
      serverRuns: true
    }
  });
  if (!engineRun) throw new QueueRetryError();
  if (engineRun.isFinalized) return;

  let serverRun = engineRun.serverRuns[0] as ServerRun | undefined;
  let serverSession = engineRun.serverSession;
  let instance = serverSession.instance;
  let serverDeployment = serverSession.serverDeployment;

  let hasEndedBefore = engineRun.hasEnded;

  let syncTime =
    engineRun.lastSyncAt.getTime() == 0
      ? engineRun.lastSyncAt
      : subSeconds(engineRun.lastSyncAt, 5);

  let start = new Date();

  let client = getRandomClient();
  if (!client) throw new Error('WTF - No manager found for engine run');

  let { run } = await client.getRun({
    runId: engineRun.id
  });
  await db.engineRun.update({
    where: { id: engineRun.id },
    data: { lastSyncAt: start, hasEnded: !!run?.endedAt, isFinalized: hasEndedBefore }
  });

  if (run?.endedAt && serverRun) {
    let endedAt = run?.endedAt ? new Date(run.endedAt.toNumber()) : new Date();
    if (endedAt.getTime() < minTime.getTime()) {
      endedAt = new Date();
    }

    await db.serverRun.updateMany({
      where: {
        oid: serverRun.oid,
        status: 'active'
      },
      data: {
        status: run.status == EngineRunStatus.run_status_error ? 'failed' : 'completed',
        lastPingAt: start,
        stoppedAt: endedAt
      }
    });
  }

  let activeServerRunsForServerSession = await db.serverRun.count({
    where: {
      serverSessionOid: serverSession.oid,
      status: 'active'
    }
  });
  if (activeServerRunsForServerSession === 0) {
    await db.serverSession.updateMany({
      where: { oid: serverSession.oid },
      data: { status: 'stopped' }
    });

    await db.sessionConnection.updateMany({
      where: { serverSessionOid: serverSession.oid, endedAt: null },
      data: { endedAt: start }
    });
  }

  let unifiedId = new UnifiedID(engineRun.serverSession.id);

  let { messages } = await client.listRunMessages({
    runId: engineRun.id,
    after: Long.fromNumber(syncTime.getTime()),
    pagination: undefined as any
  });
  if (messages.length) {
    let organization = await db.organization.findUniqueOrThrow({
      where: { oid: instance.organizationOid }
    });

    let instanceWithOrg = {
      ...instance,
      organization
    };

    for (let full of messages) {
      let message = engineMcpMessageFromPb(
        full.mcpMessage!,
        {
          type: 'server',
          id: engineRun.id
        },
        unifiedId
      );

      try {
        await createSessionMessage({
          serverSession,
          message,
          instance: instanceWithOrg
        });
      } catch (err: any) {
        if (err.code != 'P2002') throw err; // Ignore unique constraint errors
      }
    }
  }

  if (serverRun) {
    let { events } = await client.listRunEvents({
      runId: engineRun.id,
      after: Long.fromNumber(syncTime.getTime()),
      pagination: undefined as any
    });

    for (let event of events) {
      try {
        if (event.error) {
          let error = await createServerError({
            deployment: serverDeployment,
            error: event.error,
            instance,
            serverRun
          });

          await db.sessionEvent.createMany({
            data: {
              id: ID.normalizeUUID('sessionEvent', event.id),
              type: 'server_run_error',
              sessionOid: serverSession.sessionOid,
              serverRunOid: serverRun.oid,
              serverRunErrorOid: error.oid,
              engineEventId: event.id,
              payload: event.metadata,

              createdAt: new Date(event.createdAt.toNumber())
            }
          });
        } else if (event.mcpOutput) {
          let prefix = 'O';
          switch (event.mcpOutput.outputType) {
            case McpOutput_McpOutputType.remote:
              prefix = 'R';
              break;
            case McpOutput_McpOutputType.stderr:
              prefix = 'E';
              break;
            case McpOutput_McpOutputType.stdout:
              prefix = 'O';
              break;
          }

          await db.sessionEvent.createMany({
            data: {
              id: ID.normalizeUUID('sessionEvent', event.id),
              type: 'server_logs',
              sessionOid: serverSession.sessionOid,
              serverRunOid: serverRun.oid,
              engineEventId: event.id,
              payload: event.metadata,

              logLines: event.mcpOutput.lines.map(l => `${prefix}${l}`),
              createdAt: new Date(event.createdAt.toNumber())
            }
          });
        }
      } catch (err: any) {
        if (err.code != 'P2002') throw err; // Ignore unique constraint errors
      }
    }
  }
};
