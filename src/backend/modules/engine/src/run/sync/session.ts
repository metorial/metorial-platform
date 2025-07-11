import { db } from '@metorial/db';
import { getRandomClient } from '../client';

export let syncEngineSession = async (d: { engineSessionId: string }) => {
  let engineSession = await db.engineSession.findUnique({
    where: { id: d.engineSessionId },
    include: {
      serverSession: true
    }
  });
  if (!engineSession || engineSession.isFinalized) return;

  let hasEndedBefore = engineSession.hasEnded;

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
