import { addAfterTransactionHook } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { isAgentTelemetryEnabled } from '../lib/client';
import { syncScopeQueue, type ScopeSyncTarget } from '../queues/syncScope';

// Some of these events fire inside the writing transaction; the job must read the committed row.
let enqueueScopeSync = async (target: ScopeSyncTarget) => {
  if (!isAgentTelemetryEnabled()) return;

  await addAfterTransactionHook(() => syncScopeQueue.add(target));
};

Fabric.listen('organization.created:after', async ({ organization }) =>
  enqueueScopeSync({ type: 'organization', id: organization.id })
);

Fabric.listen('organization.updated:after', async ({ organization }) =>
  enqueueScopeSync({ type: 'organization', id: organization.id })
);

Fabric.listen('organization.deleted:after', async ({ organization }) =>
  enqueueScopeSync({ type: 'organization', id: organization.id })
);

Fabric.listen('organization.project.created:after', async ({ project }) =>
  enqueueScopeSync({ type: 'project', id: project.id })
);

Fabric.listen('organization.project.updated:after', async ({ project }) =>
  enqueueScopeSync({ type: 'project', id: project.id })
);

Fabric.listen('organization.project.deleted:after', async ({ project }) =>
  enqueueScopeSync({ type: 'project', id: project.id })
);

Fabric.listen('organization.project.instance.created:after', async ({ instance }) =>
  enqueueScopeSync({ type: 'instance', id: instance.id })
);

Fabric.listen('organization.project.instance.updated:after', async ({ instance }) =>
  enqueueScopeSync({ type: 'instance', id: instance.id })
);

Fabric.listen('organization.project.instance.deleted:after', async ({ instance }) =>
  enqueueScopeSync({ type: 'instance', id: instance.id })
);
