import { addAfterTransactionHook, type Organization } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { isAgentTrackingEnabled } from '../lib/client';
import { shouldSyncOrganization } from '../lib/flag';
import { syncScopeQueue, type ScopeSyncTarget } from '../queues/syncScope';

let enqueueScopeSync = async (organization: Organization, target: ScopeSyncTarget) => {
  if (!isAgentTrackingEnabled()) return;

  await addAfterTransactionHook(async () => {
    if (!(await shouldSyncOrganization(async () => organization))) return;

    await syncScopeQueue.add(target);
  });
};

Fabric.listen('organization.updated:after', async ({ organization }) =>
  enqueueScopeSync(organization, { type: 'organization', id: organization.id })
);

Fabric.listen('organization.deleted:after', async ({ organization }) =>
  enqueueScopeSync(organization, { type: 'organization', id: organization.id })
);

Fabric.listen('organization.project.updated:after', async ({ organization, project }) =>
  enqueueScopeSync(organization, { type: 'project', id: project.id })
);

Fabric.listen('organization.project.deleted:after', async ({ organization, project }) =>
  enqueueScopeSync(organization, { type: 'project', id: project.id })
);

Fabric.listen(
  'organization.project.instance.updated:after',
  async ({ organization, instance }) =>
    enqueueScopeSync(organization, { type: 'instance', id: instance.id })
);

Fabric.listen(
  'organization.project.instance.deleted:after',
  async ({ organization, instance }) =>
    enqueueScopeSync(organization, { type: 'instance', id: instance.id })
);
