import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, getId } from '@metorial-subspace/db';
import {
  createProviderInvocationId,
  getRetentionPolicy,
  redactJsonShape,
  redactSensitiveKeys
} from '@metorial-subspace/provider-utils';
import { getTenantForSlates, slates } from '../../client';
import { env } from '../../env';
import { resolveSlateAuthConfigScopes } from '../../impl/scopes';

let INITIAL_DELAY_MS = 5 * 1000;
let RETRY_DELAY_MS = 15 * 1000;
let MAX_ATTEMPTS = 200;

let getAuthConfigProcessingJobId = (d: {
  providerAuthConfigVersionId: string;
  attempt: number;
}) => `${d.providerAuthConfigVersionId}-attempt-${d.attempt}`;

export let syncAuthConfigProcessingQueue = createQueue<{
  providerAuthConfigId: string;
  providerAuthConfigVersionId: string;
  attempt: number;
}>({
  name: 'sub/slt/authCfg/proc',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let enqueueAuthConfigProcessingSync = async (d: {
  providerAuthConfigId: string;
  providerAuthConfigVersionId: string;
}) => {
  await syncAuthConfigProcessingQueue.add(
    {
      providerAuthConfigId: d.providerAuthConfigId,
      providerAuthConfigVersionId: d.providerAuthConfigVersionId,
      attempt: 1
    },
    {
      delay: INITIAL_DELAY_MS,
      id: getAuthConfigProcessingJobId({
        providerAuthConfigVersionId: d.providerAuthConfigVersionId,
        attempt: 1
      })
    }
  );
};

let getProviderInvocationId = (slateInvocationId: string | null | undefined) =>
  slateInvocationId ? createProviderInvocationId('slate.invocation', slateInvocationId) : null;

type AuthConfigVersionForSync = NonNullable<
  Awaited<ReturnType<typeof getAuthConfigVersionForSync>>
> & {
  slateAuthConfig: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getAuthConfigVersionForSync>>>['slateAuthConfig']
  >;
};

let createErrorForAuthConfig = async (d: {
  authConfigVersion: AuthConfigVersionForSync;
  record: Awaited<ReturnType<typeof slates.slateAuthConfig.get>>;
}) => {
  let sourceId = d.authConfigVersion.slateAuthConfig.id;
  let retention = getRetentionPolicy(d.authConfigVersion.authConfig.tenant);
  let safePayload = redactSensitiveKeys(d.record);

  let authConfigEvent = await db.providerAuthConfigEvent.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'slates.auth_config',
        sourceId
      }
    }
  });

  let errorCode = d.record.error?.code ?? 'auth_processing_failed';
  let errorMessage =
    d.record.error?.message ??
    'An unknown error occurred while processing the authentication configuration.';
  let providerInvocationId = getProviderInvocationId(d.record.error?.invocationId);

  if (!authConfigEvent) {
    authConfigEvent = await db.providerAuthConfigEvent.create({
      data: {
        ...getId('providerAuthConfigEvent'),
        type: 'auth_processing_failed',
        status: 'failed',
        sourceType: 'slates.auth_config',
        sourceId,
        providerInvocationId,
        payload: retention.storeErrorPayload ? safePayload : redactJsonShape(safePayload),
        authConfigOid: d.authConfigVersion.authConfigOid,
        authCredentialsOid:
          d.authConfigVersion.authCredentialsOid ??
          d.authConfigVersion.authConfig.authCredentialsOid,
        providerOid: d.authConfigVersion.authConfig.providerOid,
        tenantOid: d.authConfigVersion.authConfig.tenantOid,
        projectOid: d.authConfigVersion.authConfig.projectOid,
        environmentOid: d.authConfigVersion.authConfig.environmentOid,
        instanceOid: d.authConfigVersion.authConfig.instanceOid,
        solutionOid: d.authConfigVersion.authConfig.solutionOid
      }
    });
  }

  if (!retention.collectErrors) return;

  let existingError = await db.providerAuthConfigError.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: 'slates.auth_config',
        sourceId
      }
    }
  });
  if (existingError) return;

  let error = await db.providerAuthConfigError.create({
    data: {
      ...getId('providerAuthConfigError'),
      type: 'auth_processing_failed',
      sourceType: 'slates.auth_config',
      sourceId,
      isProcessing: true,
      code: errorCode,
      message: errorMessage,
      payload: retention.storeErrorPayload ? safePayload : redactJsonShape(safePayload),
      providerInvocationId,
      authConfigEventOid: authConfigEvent.oid,
      authConfigOid: d.authConfigVersion.authConfigOid,
      authCredentialsOid:
        d.authConfigVersion.authCredentialsOid ??
        d.authConfigVersion.authConfig.authCredentialsOid,
      providerOid: d.authConfigVersion.authConfig.providerOid,
      tenantOid: d.authConfigVersion.authConfig.tenantOid,
      projectOid: d.authConfigVersion.authConfig.projectOid,
      environmentOid: d.authConfigVersion.authConfig.environmentOid,
      instanceOid: d.authConfigVersion.authConfig.instanceOid,
      solutionOid: d.authConfigVersion.authConfig.solutionOid
    }
  });

  let hash = await Hash.sha256(
    canonicalize([
      error.type,
      String(error.providerOid),
      String(error.tenantOid),
      error.code,
      error.message
    ])
  );

  let group = await db.providerAuthConfigErrorGlobal.upsert({
    where: {
      type_hash_tenantOid: {
        type: error.type,
        hash,
        tenantOid: error.tenantOid
      }
    },
    create: {
      ...getId('providerAuthConfigErrorGlobal'),
      type: error.type,
      code: error.code,
      message: error.message,
      hash,
      providerOid: error.providerOid,
      tenantOid: error.tenantOid,
      projectOid: error.projectOid,
      environmentOid: error.environmentOid,
      instanceOid: error.instanceOid,
      firstOccurrenceOid: error.oid
    },
    update: {}
  });

  await db.providerAuthConfigErrorGlobal.updateMany({
    where: { oid: group.oid },
    data: { occurrenceCount: { increment: 1 } }
  });

  await db.providerAuthConfigError.update({
    where: { oid: error.oid },
    data: {
      isProcessing: false,
      groupOid: group.oid
    }
  });
};

let getAuthConfigVersionForSync = async (d: { providerAuthConfigVersionId: string }) =>
  await db.providerAuthConfigVersion.findUnique({
    where: { id: d.providerAuthConfigVersionId },
    include: {
      authConfig: {
        include: {
          tenant: true
        }
      },
      slateAuthConfig: true
    }
  });

export let syncAuthConfigProcessingQueueProcessor = syncAuthConfigProcessingQueue.process(
  async data => {
    let authConfigVersion = await getAuthConfigVersionForSync({
      providerAuthConfigVersionId: data.providerAuthConfigVersionId
    });
    if (!authConfigVersion) throw new QueueRetryError();
    if (!authConfigVersion.slateAuthConfig) return;

    let tenant = await getTenantForSlates(authConfigVersion.authConfig.tenant);
    let record = await slates.slateAuthConfig.get({
      tenantId: tenant.id,
      slateAuthConfigId: authConfigVersion.slateAuthConfig.id
    });

    if (record.status === 'processing') {
      if (data.attempt >= MAX_ATTEMPTS) return;

      let nextAttempt = data.attempt + 1;
      await syncAuthConfigProcessingQueue.add(
        {
          providerAuthConfigId: data.providerAuthConfigId,
          providerAuthConfigVersionId: data.providerAuthConfigVersionId,
          attempt: nextAttempt
        },
        {
          delay: RETRY_DELAY_MS,
          id: getAuthConfigProcessingJobId({
            providerAuthConfigVersionId: data.providerAuthConfigVersionId,
            attempt: nextAttempt
          })
        }
      );
      return;
    }

    if (record.status === 'failed') {
      await createErrorForAuthConfig({
        authConfigVersion: {
          ...authConfigVersion,
          slateAuthConfig: authConfigVersion.slateAuthConfig
        },
        record
      });
      return;
    }

    if (record.status === 'active') {
      let scopes = resolveSlateAuthConfigScopes(record);
      if (scopes === null) return;

      await db.providerAuthConfig.updateMany({
        where: {
          id: data.providerAuthConfigId,
          currentVersionOid: authConfigVersion.oid
        },
        data: {
          scopes,
          needsScopeSync: false
        }
      });
    }
  }
);
