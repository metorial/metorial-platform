import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '../../../db';

export let resolveClient = async (clientId: string) => {
  let account = await db.account.findUnique({
    where: { clientId },
    include: { app: true }
  });
  if (account?.status == 'active') {
    return { app: account.app, account };
  }

  let app = await db.app.findFirst({
    where: {
      OR: [{ clientId }, { slug: clientId }]
    }
  });
  if (!app) throw new ServiceError(notFoundError('app'));

  return { app, account: null };
};

export let resolveApp = async (clientId: string) => {
  return (await resolveClient(clientId)).app;
};
