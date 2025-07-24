import { db, ServerSession } from '@metorial/db';

export let getFullServerSession = async (serverSession: ServerSession) => {
  return await db.serverSession.findFirst({
    where: { id: serverSession.id },
    include: {
      serverDeployment: {
        include: {
          config: true,
          serverVariant: {
            include: { currentVersion: true }
          },
          serverImplementation: true
        }
      }
    }
  });
};

export type FullServerSession = Awaited<ReturnType<typeof getFullServerSession>>;
