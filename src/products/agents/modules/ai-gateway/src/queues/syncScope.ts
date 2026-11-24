import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getAiGateway, ignoreNotFound } from '../lib/client';
import {
  upsertInstanceScope,
  upsertOrganizationScope,
  upsertProjectScope
} from '../lib/scope';

export type ScopeSyncTarget = { type: 'organization' | 'project' | 'instance'; id: string };

export let syncScopeQueue = createQueue<ScopeSyncTarget>({
  name: 'ai-gateway/sync/scope',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncScopeQueueProcessor = syncScopeQueue.process(async data => {
  let gateway = getAiGateway();
  if (!gateway) return;

  if (data.type == 'organization') {
    let organization = await db.organization.findUnique({ where: { id: data.id } });
    if (!organization) return;

    if (organization.status != 'active') {
      await ignoreNotFound(gateway.organization.archive({ organizationId: organization.id }));
      return;
    }

    await upsertOrganizationScope({ gateway, organization });
    return;
  }

  if (data.type == 'project') {
    let project = await db.project.findUnique({
      where: { id: data.id },
      include: { organization: true }
    });
    if (!project) return;

    let { organization } = project;

    if (project.status != 'active' || organization.status != 'active') {
      await ignoreNotFound(
        gateway.project.archive({ organizationId: organization.id, projectId: project.id })
      );
      return;
    }

    await upsertProjectScope({ gateway, organization, project });
    return;
  }

  let instance = await db.instance.findUnique({
    where: { id: data.id },
    include: { organization: true, project: true }
  });
  if (!instance) return;

  let { organization, project } = instance;

  if (
    instance.status != 'active' ||
    project.status != 'active' ||
    organization.status != 'active'
  ) {
    await ignoreNotFound(
      gateway.instance.archive({ organizationId: organization.id, instanceId: instance.id })
    );
    return;
  }

  await upsertInstanceScope({ gateway, organization, project, instance });
});
