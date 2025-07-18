import { db } from '@metorial/db';
import { subSeconds } from 'date-fns';
import Long from 'long';
import { addRunSync } from '../../queues/syncRuns';
import { getRandomClient } from '../client';
import { createEngineRun } from '../data/engineRun';

export let syncEngineSession = async (d: { engineSessionId: string }) => {
  let engineSession = await db.engineSession.findUnique({
    where: { id: d.engineSessionId },
    include: {
      serverSession: true
    }
  });
  if (!engineSession || engineSession.isFinalized) return;

  let hasEndedBefore = engineSession.hasEnded;
  let serverSession = engineSession.serverSession;

  let start = new Date();

  let syncTime =
    engineSession.lastSyncAt.getTime() == 0
      ? engineSession.lastSyncAt
      : subSeconds(engineSession.lastSyncAt, 5);

  let client = getRandomClient();
  if (!client) return;

  let { session } = await client.getSession({
    sessionId: engineSession.id
  });
  await db.engineSession.update({
    where: { id: engineSession.id },
    data: { lastSyncAt: start, hasEnded: !!session?.endedAt, isFinalized: hasEndedBefore }
  });

  let { runs } = await client.listRuns({
    sessionId: engineSession.id,
    after: Long.fromValue(syncTime.getTime())
  });

  let foundRuns = await db.engineRun.findMany({
    where: {
      engineSessionId: engineSession.id,
      id: { in: runs.map(run => run.id) }
    }
  });

  let foundIds = new Set(foundRuns.map(run => run.id));

  if (foundRuns.length != runs.length) {
    let instance = await db.instance.findUnique({
      where: { oid: engineSession.serverSession.instanceOid },
      include: { organization: true }
    });

    let deployment = await db.serverDeployment.findUnique({
      where: { oid: serverSession.serverDeploymentOid },
      include: { serverVariant: { include: { currentVersion: true } } }
    });

    for (let run of runs) {
      if (foundIds.has(run.id)) continue;

      let { engineRun } = await createEngineRun({
        run,
        serverSession,
        instance: instance!,
        version: deployment!.serverVariant.currentVersion!
      });

      await addRunSync({
        engineRunId: engineRun.id
      });
    }
  }
};
