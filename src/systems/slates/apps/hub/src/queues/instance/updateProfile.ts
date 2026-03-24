import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { secretService, slateInvocationService } from '../../services';

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

  console.log('Updating profile for auth config', authConfig.id);

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
  console.log('Got profile result for auth config', authConfig.id, res);
  if (res.status === 'error') return;

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
