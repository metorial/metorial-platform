import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { db } from '../../db';
import { env } from '../../env';
import { extractExpiresAt } from '../../lib/extractExpiresAt';
import { secretService, slateErrorService, slateInvocationService } from '../../services';
import { updateProfileQueue } from './updateProfile';

export let processAuthQueue = createQueue<{
  configId: string;
}>({
  name: 'shub/soat/procAuth',
  redisUrl: env.service.REDIS_URL
});

export let processAuthQueueProcessor = processAuthQueue.process(async data => {
  let authConfig = await db.slateAuthConfig.findFirst({
    where: { id: data.configId },
    include: {
      authMethod: true,
      oauthCredentials: true,
      instance: true,
      slate: true,
      tenant: true
    }
  });
  if (!authConfig || !authConfig.slate.currentVersionOid) throw new QueueRetryError();
  let version = await db.slateVersion.findUnique({
    where: {
      oid: authConfig.instance?.lockedSlateVersionOid ?? authConfig.slate.currentVersionOid
    }
  });
  if (!version) throw new QueueRetryError();

  let decrypted = await secretService.DANGEROUSLY_decryptSecret({
    secretOid: authConfig.secretOid,
    purpose: 'slate_authentication_configuration',
    tenant: authConfig.tenant
  });

  let secretUpdated = false;

  if (
    decrypted.input &&
    !decrypted.output &&
    authConfig.authMethod.spec.capabilities.handleChangedInput?.enabled
  ) {
    let stack = await slateInvocationService.createInvocation({
      slateVersion: version,
      participants: []
    });
    let res = await slateInvocationService.sendUpdatedAuthInput({
      stack,
      authenticationMethodId: authConfig.authMethod.key,
      previousInput: null,
      newInput: decrypted.input
    });
    if (res.status === 'error') {
      await db.slateAuthConfig.updateMany({
        where: { oid: authConfig.oid },
        data: {
          isProcessing: false,
          errorCode: res.error.code,
          errorMessage: res.error.message,
          errorInvocationId: res.invocation.id
        }
      });
      slateErrorService
        .recordSlateError({
          type: 'auth_processing_failed',
          errorCode: res.error.code,
          errorMessage: res.error.message,
          tenantOid: authConfig.tenant.oid,
          slateOid: authConfig.slateOid,
          slateVersionOid: version.oid,
          slateInstanceOid: authConfig.instance?.oid,
          invocationOid: res.invocation.oid,
          authConfigOid: authConfig.oid
        })
        .catch(() => {});
      throw new QueueRetryError();
    }

    if (res.data.input) {
      decrypted.input = res.data.input;
      secretUpdated = true;
    }
  }

  if (!decrypted.output) {
    let stack = await slateInvocationService.createInvocation({
      slateVersion: version,
      participants: []
    });
    let res = await slateInvocationService.getAuthOutput({
      stack,
      authenticationMethodId: authConfig.authMethod.key,
      input: decrypted.input ?? {}
    });
    if (res.status === 'error') {
      await db.slateAuthConfig.updateMany({
        where: { oid: authConfig.oid },
        data: {
          isProcessing: false,
          errorCode: res.error.code,
          errorMessage: res.error.message,
          errorInvocationId: res.invocation.id
        }
      });
      slateErrorService
        .recordSlateError({
          type: 'auth_processing_failed',
          errorCode: res.error.code,
          errorMessage: res.error.message,
          tenantOid: authConfig.tenant.oid,
          slateOid: authConfig.slateOid,
          slateVersionOid: version.oid,
          slateInstanceOid: authConfig.instance?.oid,
          invocationOid: res.invocation.oid,
          authConfigOid: authConfig.oid
        })
        .catch(() => {});
      throw new QueueRetryError();
    }

    decrypted.output = res.data.output;
    secretUpdated = true;
  }

  let tokenExpiresAt = extractExpiresAt(decrypted.output);
  if (tokenExpiresAt !== authConfig.tokenExpiresAt) {
    await db.slateAuthConfig.updateMany({
      where: { oid: authConfig.oid },
      data: { tokenExpiresAt }
    });
  }

  if (secretUpdated) {
    await secretService.DANGEROUSLY_updateSecret({
      secretOid: authConfig.secretOid,
      purpose: 'slate_authentication_configuration',
      tenant: authConfig.tenant,
      secretData: decrypted
    });
  }

  await db.slateAuthConfig.updateMany({
    where: { oid: authConfig.oid },
    data: { isProcessing: false, errorCode: null, errorMessage: null, errorInvocationId: null }
  });

  if (authConfig.authMethod.spec.capabilities.getProfile?.enabled) {
    await updateProfileQueue.add({
      configId: authConfig.id
    });
  }
});
