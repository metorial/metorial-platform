import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '../../../db';

export let resolveApp = async (clientId: string) => {
  let app = await db.app.findFirst({
    where: {
      OR: [{ clientId }, { slug: clientId }]
    }
  });
  if (!app) throw new ServiceError(notFoundError('app'));
  return app;
};
