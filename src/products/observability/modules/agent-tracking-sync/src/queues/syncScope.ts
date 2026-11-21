import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getAgentTracking, ignoreNotFound } from '../lib/client';
import { isAgentTrackingEnabledForOrganization } from '../lib/flag';
import { unlinkInstance, unlinkOrganizationTree, unlinkProject } from '../lib/links';
import { pushInstanceScope, pushOrganizationScope, pushProjectScope } from '../lib/scope';

export type ScopeSyncTarget = { type: 'organization' | 'project' | 'instance'; id: string };

export let syncScopeQueue = createQueue<ScopeSyncTarget>({
  name: 'agent-tracking/sync/scope',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let syncScopeQueueProcessor = syncScopeQueue.process(async data => {
  let agentTracking = getAgentTracking();
  if (!agentTracking) return;

  if (data.type == 'organization') {
    let organization = await db.organization.findUnique({
      where: { id: data.id },
      include: { agentTrackingLink: true }
    });
    if (!organization) return;
    if (!(await isAgentTrackingEnabledForOrganization({ organization }))) return;

    if (organization.status != 'active') {
      await ignoreNotFound(
        agentTracking.organization.archive({ organizationId: organization.id })
      );
      await unlinkOrganizationTree(organization);
      return;
    }

    if (organization.agentTrackingLink) {
      await pushOrganizationScope({ agentTracking, organization });
    }
    return;
  }

  if (data.type == 'project') {
    let project = await db.project.findUnique({
      where: { id: data.id },
      include: { organization: true, agentTrackingLink: true }
    });
    if (!project) return;

    let { organization } = project;
    if (!(await isAgentTrackingEnabledForOrganization({ organization, project }))) return;

    if (project.status != 'active' || organization.status != 'active') {
      await ignoreNotFound(
        agentTracking.project.archive({
          organizationId: organization.id,
          projectId: project.id
        })
      );
      await unlinkProject(project);
      return;
    }

    if (project.agentTrackingLink) {
      await pushProjectScope({ agentTracking, organization, project });
    }
    return;
  }

  let instance = await db.instance.findUnique({
    where: { id: data.id },
    include: { organization: true, project: true, agentTrackingLink: true }
  });
  if (!instance) return;

  let { organization, project } = instance;
  if (!(await isAgentTrackingEnabledForOrganization({ organization, project }))) return;

  if (
    instance.status != 'active' ||
    project.status != 'active' ||
    organization.status != 'active'
  ) {
    await ignoreNotFound(
      agentTracking.instance.archive({
        organizationId: organization.id,
        instanceId: instance.id
      })
    );
    await unlinkInstance(instance);
    return;
  }

  if (instance.agentTrackingLink) {
    await pushInstanceScope({ agentTracking, organization, project, instance });
  }
});
