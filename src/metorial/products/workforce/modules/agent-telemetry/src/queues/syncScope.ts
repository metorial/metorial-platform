import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getGroundstation, ignoreNotFound } from '../lib/client';
import {
  upsertInstanceScope,
  upsertOrganizationScope,
  upsertProjectScope
} from '../lib/scope';

export type ScopeSyncTarget = { type: 'organization' | 'project' | 'instance'; id: string };

export let syncScopeQueue = createQueue<ScopeSyncTarget>({
  name: 'agent-telemetry/sync/scope',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncScopeQueueProcessor = syncScopeQueue.process(async data => {
  let groundstation = getGroundstation();
  if (!groundstation) return;

  if (data.type == 'organization') {
    let organization = await db.organization.findUnique({ where: { id: data.id } });
    if (!organization) return;

    if (organization.status != 'active') {
      await ignoreNotFound(
        groundstation.organization.archive({ organizationId: organization.id })
      );
      return;
    }

    await upsertOrganizationScope({ groundstation, organization });
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
        groundstation.project.archive({
          organizationId: organization.id,
          projectId: project.id
        })
      );
      return;
    }

    await upsertProjectScope({ groundstation, organization, project });
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
      groundstation.instance.archive({
        organizationId: organization.id,
        instanceId: instance.id
      })
    );
    return;
  }

  await upsertInstanceScope({ groundstation, organization, project, instance });
});
