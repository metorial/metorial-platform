import {
  CallbackTemplate,
  db,
  ID,
  Instance,
  LambdaServerInstance,
  withTransaction
} from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { generatePlainId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { registerCallbackQueue } from '../queue/registerCallback';

let include = {
  hooks: true,
  schedule: true
};

class callbackServiceImpl {
  async internalCreateCallbackForServerDeployment(d: {
    instance: Instance;
    callbackTemplate: CallbackTemplate;
    lambda: LambdaServerInstance;
  }) {
    return withTransaction(async db => {
      let callback = await db.callback.create({
        data: {
          id: await ID.generateId('callback'),
          instanceOid: d.instance.oid,
          eventType: d.callbackTemplate.eventType,

          intervalSeconds: d.instance.defaultCallbackPollingIntervalSeconds,

          hooks:
            d.callbackTemplate.eventType == 'polling'
              ? undefined
              : {
                  create: {
                    id: await ID.generateId('callbackHook'),
                    key: generatePlainId(45)
                  }
                }
        },
        include: {
          hooks: true
        }
      });

      await registerCallbackQueue.add({
        callbackId: callback.id,
        lambdaId: d.lambda.id
      });

      return callback;
    });
  }

  async getCallbackById(d: { instance: Instance; callbackId: string }) {
    let callback = await db.callback.findFirst({
      where: {
        id: d.callbackId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!callback) throw new ServiceError(notFoundError('callback', d.callbackId));

    return callback;
  }

  async listCallbacks(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.callback.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid
            },
            include
          })
      )
    );
  }
}

export let callbackService = Service.create(
  'callbackService',
  () => new callbackServiceImpl()
).build();
