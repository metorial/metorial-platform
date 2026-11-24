import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { isTransientInvocationError } from '../../lib/invocationErrors';
import { slateErrorService, slateInvocationService } from '../../services';

export let slateInstanceConfigChangedQueue = createQueue<{
  previousConfigId?: string | null;
  newConfigId: string;
  versionId: string;
}>({
  name: 'shub/sin/cfg/chgd',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL
});

export let slateInstanceConfigChangedQueueProcessor = slateInstanceConfigChangedQueue.process(
  async (data, job) => {
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

    let recordValidationError = (d: { errorCode: string; errorMessage: string }) =>
      slateErrorService
        .recordSlateError({
          type: 'config_validation_failed',
          errorCode: d.errorCode,
          errorMessage: d.errorMessage,
          tenantOid: newConfig.tenantOid,
          slateOid: newConfig.instance.slateOid,
          slateVersionOid: version.oid,
          slateInstanceOid: newConfig.instance.oid,
          invocationOid: res.invocation.oid,
          instanceConfigOid: newConfig.oid
        })
        .catch(() => {});

    if (res.status === 'error') {
      // A stored config error blocks every tool call on the instance, so a runtime outage
      // must not be persisted; retry until the slate can actually judge the config.
      if (isTransientInvocationError(res.error)) {
        if (job.attemptsMade === 0) {
          recordValidationError({
            errorCode: res.error.code,
            errorMessage: res.error.message
          });
        }

        throw new QueueRetryError();
      }

      await db.slateInstanceConfig.updateMany({
        where: { oid: newConfig.oid },
        data: {
          errorCode: res.error.code,
          errorMessage: res.error.message,
          errorInvocationId: res.invocation.id
        }
      });
      recordValidationError({ errorCode: res.error.code, errorMessage: res.error.message });
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
      recordValidationError({ errorCode: 'invalid_config', errorMessage });
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
