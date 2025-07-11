import { db } from '@metorial/db';
import { subSeconds } from 'date-fns';
import { getRandomClient } from '../client';

export let syncEngineSession = async (d: { engineSessionId: string }) => {
  let engineSession = await db.engineSession.findUnique({
    where: { id: d.engineSessionId },
    include: {
      serverSession: true
    }
  });
  if (!engineSession || engineSession.isFinalized) return;

  let serverSession = engineSession.serverSession;

  let hasEndedBefore = engineSession.hasEnded;

  let syncTime =
    engineSession.lastSyncAt.getTime() == 0
      ? engineSession.lastSyncAt
      : subSeconds(engineSession.lastSyncAt, 5);

  let start = new Date();

  let client = getRandomClient();
  if (!client) return;

  let { session } = await client.getSession({
    sessionId: engineSession.id
  });
  await db.engineSession.update({
    where: { id: engineSession.id },
    data: { lastSyncAt: start, hasEnded: !!session?.endedAt, isFinalized: hasEndedBefore }
  });
};
