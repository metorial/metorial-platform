import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import {
  defaultAdminScopesHash,
  defaultEveryoneScopesHash
} from '../definitions/defaultScopes';
import { accessPolicyService } from '../services/accessPolicy';
import { authBootstrapService } from '../services/authBootstrap';
import { organizationActorService } from '../services/organizationActor';

export let reconcileDefaultPoliciesCron = createCron(
  {
    name: 'org/def-policy/rec/cron',
    cron: '* * * * *'
  },
  async () => {
    await reconcileDefaultPoliciesManyQueue.add({});
  }
);

export let reconcileDefaultPoliciesManyQueue = createQueue<{ cursor?: string }>({
  name: 'org/def-policy/rec/many',
  workerOpts: {
    concurrency: 5
  }
});

let reconcileDefaultPoliciesManyQueueProcessor = reconcileDefaultPoliciesManyQueue.process(
  async data => {
    let accessPolicies = await db.accessPolicy.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined,
        hasBeenCustomized: false,
        OR: [
          { type: 'admin', autoUpdateScopesHash: { not: defaultAdminScopesHash } },
          { type: 'everyone', autoUpdateScopesHash: { not: defaultEveryoneScopesHash } },

          { type: 'admin', autoUpdateScopesHash: null },
          { type: 'everyone', autoUpdateScopesHash: null }
        ]
      },
      take: 100,
      orderBy: { id: 'asc' }
    });

    if (accessPolicies.length == 0) return;

    await reconcileDefaultPoliciesSingleQueue.addMany(
      accessPolicies.map(accessPolicy => ({
        accessPolicyId: accessPolicy.id
      }))
    );

    await reconcileDefaultPoliciesManyQueue.add({
      cursor: accessPolicies[accessPolicies.length - 1].id
    });
  }
);

let reconcileDefaultPoliciesSingleQueue = createQueue<{ accessPolicyId: string }>({
  name: 'org/def-policy/rec/single',
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 5,
      duration: 1000
    }
  }
});

export let reconcileDefaultPoliciesSingleQueueProcessor =
  reconcileDefaultPoliciesSingleQueue.process(async data => {
    let accessPolicy = await db.accessPolicy.findUnique({
      where: { id: data.accessPolicyId },
      include: { organization: true }
    });
    if (!accessPolicy) return;

    let system = await organizationActorService.getSystemActor({
      organization: accessPolicy.organization
    });

    if (
      accessPolicy.type == 'admin' &&
      accessPolicy.autoUpdateScopesHash != defaultAdminScopesHash &&
      !accessPolicy.hasBeenCustomized
    ) {
      await accessPolicyService.updateAccessPolicy({
        accessPolicy,
        organization: accessPolicy.organization,
        performedBy: system,
        context: { ip: '0.0.0.0', ua: 'Metorial' },
        allowDefaultDocumentUpdate: true,
        input: {
          document: await authBootstrapService.getAdminPolicyDocument({
            organization: accessPolicy.organization
          }),
          message: 'Reconcile default administrators policy'
        }
      });

      await db.accessPolicy.updateMany({
        where: { id: accessPolicy.id },
        data: { autoUpdateScopesHash: defaultAdminScopesHash }
      });
    }

    if (
      accessPolicy.type == 'everyone' &&
      accessPolicy.autoUpdateScopesHash != defaultEveryoneScopesHash &&
      !accessPolicy.hasBeenCustomized
    ) {
      await accessPolicyService.updateAccessPolicy({
        accessPolicy,
        organization: accessPolicy.organization,
        performedBy: system,
        context: { ip: '0.0.0.0', ua: 'Metorial' },
        allowDefaultDocumentUpdate: true,
        input: {
          document: await authBootstrapService.getEveryonePolicyDocument({
            organization: accessPolicy.organization
          }),
          message: 'Reconcile default everyone policy'
        }
      });

      await db.accessPolicy.updateMany({
        where: { id: accessPolicy.id },
        data: { autoUpdateScopesHash: defaultEveryoneScopesHash }
      });
    }
  });

export let reconcileDefaultPoliciesProcessors = combineQueueProcessors([
  reconcileDefaultPoliciesCron,
  reconcileDefaultPoliciesManyQueueProcessor,
  reconcileDefaultPoliciesSingleQueueProcessor
]);
