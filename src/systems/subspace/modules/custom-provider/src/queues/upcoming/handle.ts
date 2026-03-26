import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  addAfterTransactionHook,
  type CustomProvider,
  type CustomProviderDeployment,
  type CustomProviderFrom,
  type CustomProviderVersion,
  db,
  type Environment,
  type Solution,
  type Tenant,
  type TenantActor,
  withTransaction
} from '@metorial-subspace/db';
import { backend, type CustomProviderFromInternal } from '../../_shuttle/backend';
import { env } from '../../env';
import { createVersion } from '../../internal/createVersion';
import { ensureEnvironments } from '../../internal/ensureEnvironments';
import { getImmutableBucketForCustomProviderVersion } from '../../internal/files';
import { origin } from '../../origin';
import { customDeploymentFailedQueue } from '../deployment/failed';
import { customProviderCreatedQueue } from '../lifecycle/customProvider';

export let handleUpcomingCustomProviderQueue = createQueue<{
  upcomingCustomProviderId: string;
}>({
  name: 'sub/cpr/up/hdl',
  redisUrl: env.service.REDIS_URL
});

let mapFrom = async (d: {
  provider: CustomProvider;
  deployment: CustomProviderDeployment;
  version: CustomProviderVersion;
  from: CustomProviderFrom;

  isInitial: boolean;

  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  actor: TenantActor;
}): Promise<CustomProviderFromInternal> => {
  if (d.from.type === 'container') {
    return {
      type: 'container.from_image_ref',
      ...d.from.repository
    };
  }

  if (d.from.type === 'remote') {
    return d.from;
  }

  if (d.from.type === 'function') {
    let { immutableBucket, originTenant } =
      await getImmutableBucketForCustomProviderVersion(d);

    let files = await origin.codeBucket.getFiles({
      tenantId: originTenant.id,
      codeBucketId: immutableBucket.id
    });

    return {
      type: 'function',

      env: d.from.env,
      runtime: d.from.runtime,

      files: files.files.map((f: { path: string; content: string; encoding: 'base64' }) => ({
        filename: f.path.startsWith('/') ? f.path.slice(1) : f.path,
        content: f.content,
        encoding: f.encoding
      }))
    };
  }

  throw new Error('Unsupported from type');
};

export let handleUpcomingCustomProviderQueueProcessor =
  handleUpcomingCustomProviderQueue.process(async data => {
    let upcoming = await db.upcomingCustomProvider.findUnique({
      where: { id: data.upcomingCustomProviderId },
      include: {
        tenant: true,
        solution: true,
        environment: true,
        actor: true,
        customProvider: true,
        customProviderDeployment: true,
        customProviderVersion: true
      }
    });
    if (!upcoming) throw new QueueRetryError();
    try {
      let from = await mapFrom({
        isInitial: false,

        deployment: upcoming.customProviderDeployment,
        version: upcoming.customProviderVersion,
        provider: upcoming.customProvider,
        from: upcoming.payload.from,

        tenant: upcoming.tenant,
        solution: upcoming.solution,
        environment: upcoming.environment,
        actor: upcoming.actor
      });

      let backendProvider =
        upcoming.type === 'create_custom_provider'
          ? await backend.createCustomProvider({
              tenant: upcoming.tenant,

              name: upcoming.customProvider.name,
              description: upcoming.customProvider.description ?? undefined,

              config: upcoming.payload.config,
              from
            })
          : await backend.createCustomProviderVersion({
              tenant: upcoming.tenant,
              customProvider: upcoming.customProvider,

              config: upcoming.payload.config,
              from
            });

      await withTransaction(async db => {
        await ensureEnvironments({ customProvider: upcoming.customProvider });

        await createVersion({
          actor: upcoming.actor,
          tenant: upcoming.tenant,
          solution: upcoming.solution,
          environment: upcoming.environment,

          message:
            upcoming.message ??
            (upcoming.type === 'create_custom_provider' ? 'Initial commit' : undefined),

          customProvider: upcoming.customProvider,
          version: upcoming.customProviderVersion,
          deployment: upcoming.customProviderDeployment,

          shuttleServer: backendProvider.shuttleServer,
          shuttleCustomServer: backendProvider.shuttleCustomServer,
          shuttleCustomDeployment: backendProvider.shuttleCustomDeployment
        });

        if (upcoming.type === 'create_custom_provider') {
          await addAfterTransactionHook(async () =>
            customProviderCreatedQueue.add({
              customProviderId: upcoming.customProvider.id
            })
          );
        }

        await db.upcomingCustomProvider.deleteMany({
          where: { id: upcoming.id }
        });
      });
    } catch (error) {
      if (error instanceof QueueRetryError) throw error;

      let message = error instanceof Error ? error.message : 'Unknown deployment error';

      await db.upcomingCustomProvider.updateMany({
        where: { id: upcoming.id },
        data: {
          errorCode: 'deployment_failed',
          errorMessage: message.slice(0, 1000)
        }
      });

      await customDeploymentFailedQueue.add({
        customProviderDeploymentId: upcoming.customProviderDeployment.id
      });
    }
  });
