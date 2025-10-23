import { createCachedFunction } from '@metorial/cache';
import { db } from '@metorial/db';

export let getConnectionLambda = createCachedFunction({
  name: 'clb/lmb1',
  ttlSeconds: process.env.NODE_ENV == 'development' ? 1 : 60,
  getHash: c => c,
  provider: async (callbackId: string) => {
    let callback = await db.callback.findFirst({
      where: { id: callbackId },
      include: {
        serverDeployment: {
          include: {
            server: {
              include: {
                customServer: {
                  include: {
                    currentVersion: {
                      include: {
                        lambdaServerInstance: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    return {
      // callback: { ...callback, serverDeployment: undefined },
      lambdaInstance:
        callback?.serverDeployment?.server.customServer?.currentVersion?.lambdaServerInstance
    };
  }
});
