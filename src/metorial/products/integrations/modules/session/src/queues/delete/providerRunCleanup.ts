import { db } from '@metorial-subspace/db';

export let deleteProviderRunsBySessionOid = async (sessionOid: bigint) => {
  let providerRuns = await db.providerRun.findMany({
    where: { sessionOid },
    select: { oid: true }
  });
  let providerRunOids = providerRuns.map(providerRun => providerRun.oid);

  if (providerRunOids.length === 0) return;

  let slateSessions = await db.slateSession.findMany({
    where: { providerRunOid: { in: providerRunOids } },
    select: { oid: true }
  });
  let slateSessionOids = slateSessions.map(session => session.oid);

  if (slateSessionOids.length > 0) {
    let slateToolCalls = await db.slateToolCall.findMany({
      where: { sessionOid: { in: slateSessionOids } },
      select: { oid: true }
    });
    let slateToolCallOids = slateToolCalls.map(toolCall => toolCall.oid);

    if (slateToolCallOids.length > 0) {
      await db.slateToolCall.deleteMany({
        where: { oid: { in: slateToolCallOids } }
      });
    }

    await db.slateSession.deleteMany({
      where: { oid: { in: slateSessionOids } }
    });
  }

  await db.shuttleConnection.deleteMany({
    where: { providerRunOid: { in: providerRunOids } }
  });

  await db.providerRunUsageRecord.deleteMany({
    where: { providerRunOid: { in: providerRunOids } }
  });

  await db.providerRun.deleteMany({
    where: { oid: { in: providerRunOids } }
  });
};
