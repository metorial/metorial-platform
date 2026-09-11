import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '../../../db';

export let resolveClient = async (clientId: string) => {
  let account = await db.account.findFirst({
    where: {
      OR: [{ clientId }, { identifier: clientId }, { id: clientId }]
    },
    include: { app: true }
  });
  if (account?.status == 'active') {
    return { app: account.app, account };
  }

  let app = await db.app.findFirst({
    where: {
      OR: [{ clientId }, { slug: clientId }, { id: clientId }]
    }
  });
  if (!app) throw new ServiceError(notFoundError('app'));

  return { app, account: null };
};

export let resolveApp = async (clientId: string) => {
  return (await resolveClient(clientId)).app;
};

export let getHorizonApp = () =>
  db.app.findFirst({ where: { mode: 'horizon' }, orderBy: { oid: 'desc' } });

export let resolveClientOrDefault = async (clientId?: string | null) => {
  if (clientId) return resolveClient(clientId);

  let app = await getHorizonApp();
  if (!app) {
    throw new ServiceError(
      badRequestError({
        message: 'client_id is required: no default app is configured'
      })
    );
  }

  return { app, account: null };
};
