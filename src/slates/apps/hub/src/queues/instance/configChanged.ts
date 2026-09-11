import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { slateErrorService, slateInvocationService } from '../../services';

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
      include: { instance: true, tenant: true }
    });
    let version = await db.slateVersion.findUnique({
      where: { id: data.versionId },
      include: {}
    });
    if (!newConfig || !version) throw new QueueRetryError();

    let stack = await slateInvocationService.createInvocation({
      tenant: newConfig.tenant,
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
          errorMessage: res.error.message,
          errorInvocationId: res.invocation.id
        }
      });
      slateErrorService
        .recordSlateError({
          type: 'config_validation_failed',
          errorCode: res.error.code,
          errorMessage: res.error.message,
          tenantOid: newConfig.tenantOid,
          slateOid: newConfig.instance.slateOid,
          slateVersionOid: version.oid,
          slateInstanceOid: newConfig.instance.oid,
          invocationOid: res.invocation.oid,
          instanceConfigOid: newConfig.oid
        })
        .catch(() => {});
      return;
    }
    if (!res.data.success) {
      let errorMessage =
        `The provided configuration is invalid ${res.data.errors ? `- ${(res.data.errors ?? []).map(e => e.message).join(', ')}` : ''}`.trim();
      await db.slateInstanceConfig.updateMany({
        where: { oid: newConfig.oid },
        data: {
          errorCode: 'invalid_config',
          errorMessage,
          errorInvocationId: res.invocation.id
        }
      });
      slateErrorService
        .recordSlateError({
          type: 'config_validation_failed',
          errorCode: 'invalid_config',
          errorMessage,
          tenantOid: newConfig.tenantOid,
          slateOid: newConfig.instance.slateOid,
          slateVersionOid: version.oid,
          slateInstanceOid: newConfig.instance.oid,
          invocationOid: res.invocation.oid,
          instanceConfigOid: newConfig.oid
        })
        .catch(() => {});
      return;
    }

    await db.slateInstanceConfig.updateMany({
      where: { oid: newConfig.oid },
      data: {
        value: res.data.config ?? newConfig.value,
        errorCode: null,
        errorMessage: null,
        errorInvocationId: null
      }
    });
  }
);
