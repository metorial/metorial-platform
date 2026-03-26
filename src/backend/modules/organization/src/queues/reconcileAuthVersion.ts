import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';
import { authBootstrapService } from '../services/authBootstrap';

export let reconcileAuthVersionCron = createCron(
  {
    name: 'org/auth-version/rec/cron',
    cron: '* * * * *'
  },
  async () => {
    let organizations = await db.organization.findMany({
      where: {
        status: 'active',
        authVersion: 'v1'
      }
    });
    if (organizations.length == 0) return;

    await reconcileAuthVersionQueue.addMany(
      organizations.map(organization => ({
        organizationId: organization.id
      }))
    );
  }
);

let reconcileAuthVersionQueue = createQueue<{ organizationId: string }>({
  name: 'org/auth-version/rec/single',
  workerOpts: {
    concurrency: 5,
    limiter: {
      max: 1,
      duration: 1000
    }
  }
});

export let reconcileAuthVersionQueueProcessor = reconcileAuthVersionQueue.process(
  async data => {
    let organization = await db.organization.findUnique({
      where: { id: data.organizationId }
    });
    if (!organization) throw new QueueRetryError();

    await authBootstrapService.ensureOrganizationAuthVersionV2({
      organization,
      context: { ip: '0.0.0.0', ua: 'Metorial' }
    });
  }
);

export let reconcileAuthVersionProcessors = combineQueueProcessors([
  reconcileAuthVersionCron,
  reconcileAuthVersionQueueProcessor
]);
