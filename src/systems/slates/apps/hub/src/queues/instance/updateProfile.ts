import { createQueue, QueueRetryError } from '@mtsrc/queue';
import { getSentry } from '@mtsrc/sentry';
import { db } from '../../db';
import { env } from '../../env';
import { secretService, slateErrorService, slateInvocationService } from '../../services';

let Sentry = getSentry();

export let updateProfileQueue = createQueue<{
  configId: string;
}>({
  name: 'shub/soat/upprof',
  redisUrl: env.service.REDIS_URL
});

export let updateProfileQueueProcessor = updateProfileQueue.process(async data => {
  let authConfig = await db.slateAuthConfig.findFirst({
    where: { id: data.configId },
    include: {
      authMethod: {
        include: {
          mostRecentSpecification: {
            include: {
              mostRecentVersion: true
            }
          }
        }
      },
      oauthCredentials: true,
      tenant: true
    }
  });
  if (!authConfig) throw new QueueRetryError();

  if (!authConfig.authMethod.spec.capabilities.getProfile?.enabled) {
    return;
  }

  let version = authConfig.authMethod.mostRecentSpecification?.mostRecentVersion;
  if (!version) return;

  let decrypted = await secretService.DANGEROUSLY_decryptSecret({
    secretOid: authConfig.secretOid,
    purpose: 'slate_authentication_configuration',
    tenant: authConfig.tenant
  });

  let stack = await slateInvocationService.createInvocation({
    slateVersion: version,
    participants: []
  });
  let res = await slateInvocationService.getAuthProfile({
    stack,
    authenticationMethodId: authConfig.authMethod.key,
    scopes: authConfig.oauthCredentials?.scopes || [],
    input: decrypted.input || {},
    output: decrypted.output || {}
  });
  if (res.status === 'error') {
    Sentry.captureMessage('Failed to fetch auth profile', {
      level: 'warning',
      extra: {
        authConfigId: authConfig.id,
        errorCode: res.error.code,
        errorMessage: res.error.message,
        invocationId: res.invocation.id
      }
    });
    slateErrorService
      .recordSlateError({
        type: 'profile_fetch_failed',
        errorCode: res.error.code,
        errorMessage: res.error.message,
        tenantOid: authConfig.tenant.oid,
        slateOid: authConfig.authMethod.mostRecentSpecification?.slateOid,
        slateVersionOid: version?.oid,
        invocationOid: res.invocation.oid,
        authConfigOid: authConfig.oid
      })
      .catch(() => {});
    return;
  }

  let profile = {
    ...res.data.profile,
    id: res.data.profile.id ? String(res.data.profile.id) : undefined,
    email: res.data.profile.email,
    name: res.data.profile.name,
    imageUrl: res.data.profile.imageUrl
  };

  await db.slateAuthConfig.updateMany({
    where: { oid: authConfig.oid },
    data: {
      profile: profile,
      profileUid: profile.id,
      profileEmail: profile.email,
      profileName: profile.name
    }
  });
});
