import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { slateInvocationService } from '../../services';

export let slateInstanceConfigChangedQueue = createQueue<{
  previousConfigId?: string | null;
  newConfigId: string;
  versionId: string;
}>({
  name: 'shub/sin/cfg/chgd',
  redisUrl: env.service.REDIS_URL
});

export let slateInstanceConfigChangedQueueProcessor = slateInstanceConfigChangedQueue.process(
  async data => {
    let previousConfig = data.previousConfigId
      ? await db.slateInstanceConfig.findUnique({
          where: { id: data.previousConfigId },
          include: {}
        })
      : null;
    let newConfig = await db.slateInstanceConfig.findUnique({
      where: { id: data.newConfigId },
      include: {}
    });
    let version = await db.slateVersion.findUnique({
      where: { id: data.versionId },
      include: {}
    });
    if (!newConfig || !version) throw new QueueRetryError();

    let stack = await slateInvocationService.createInvocation({
      slateVersion: version,
      participants: []
    });
    let res = await slateInvocationService.sendUpdatedConfig({
      stack,
      previousConfig: previousConfig ? previousConfig.value : null,
      newConfig: newConfig.value
    });
    if (res.status === 'error') {
      await db.slateInstanceConfig.updateMany({
        where: { oid: newConfig.oid },
        data: {
          errorCode: res.error.code,
          errorMessage: res.error.message
        }
      });
      return;
    }
    if (!res.data.success) {
      await db.slateInstanceConfig.updateMany({
        where: { oid: newConfig.oid },
        data: {
          errorCode: 'invalid_config',
          errorMessage:
            `The provided configuration is invalid ${res.data.errors ? `- ${(res.data.errors ?? []).map(e => e.message).join(', ')}` : ''}`.trim()
        }
      });
      return;
    }

    await db.slateInstanceConfig.updateMany({
      where: { oid: newConfig.oid },
      data: {
        value: res.data.config ?? newConfig.value,
        errorCode: null,
        errorMessage: null
      }
    });
  }
);
