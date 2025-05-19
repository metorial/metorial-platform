import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { subMinutes } from 'date-fns';

let disconnectSessionsCron = createCron(
  {
    name: 'ses/con/check',
    cron: '* * * * *'
  },
  async () => {
    let now = new Date();
    let oneMinuteAgo = subMinutes(now, 1);

    let sessionsToDisconnect = await db.session.findMany({
      where: {
        connectionStatus: 'connected',
        lastClientPingAt: {
          lte: oneMinuteAgo
        }
      }
    });

    disconnectSessionQueue.addMany(
      sessionsToDisconnect.map(session => ({
        sessionId: session.id,
        lastClientPingAt: session.lastClientPingAt
      }))
    );
  }
);

let disconnectSessionQueue = createQueue<{ sessionId: string; lastClientPingAt: Date | null }>(
  {
    name: 'ses/con/stop'
  }
);

let disconnectSessionQueueProcessor = disconnectSessionQueue.process(async data => {
  let session = await db.session.update({
    where: {
      id: data.sessionId,
      connectionStatus: 'connected',
      lastClientPingAt: data.lastClientPingAt
    },
    data: {
      connectionStatus: 'disconnected'
    }
  });

  await db.serverRun.updateMany({
    where: {
      serverSession: {
        sessionOid: session.oid
      },
      stoppedAt: null
    },
    data: {
      stoppedAt: new Date()
    }
  });

  await db.serverSession.updateMany({
    where: {
      sessionOid: session.oid,
      status: { in: ['running'] }
    },
    data: {
      status: 'stopped'
    }
  });
});

export let checkSessionsProcessors = combineQueueProcessors([
  disconnectSessionsCron,
  disconnectSessionQueueProcessor
]);
