import { createSystemAuditScope } from '@metorial/audit-scope';
import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { consumerProfileService } from '@metorial/module-consumer-core';
import { combineQueueProcessors, createQueue, QueueRetryError } from '@metorial/queue';

let batchSize = 100;

type ReconcileManyInput =
  | { scope: 'project'; projectId: string; cursor?: string }
  | { scope: 'member'; memberId: string; cursor?: string }
  | { scope: 'portal'; portalId: string; cursor?: string };

export let reconcileOrganizationMembersManyQueue = createQueue<ReconcileManyInput>({
  name: 'portal/reconcile-org-members/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileOrganizationMembersSingleQueue = createQueue<{
  portalId: string;
  memberId: string;
}>({
  name: 'portal/reconcile-org-members/single',
  workerOpts: { concurrency: 10 }
});

let enqueuePortalScopes = async (d: { projectId: string; cursor?: string }) => {
  let project = await db.project.findUnique({ where: { id: d.projectId } });
  if (!project) throw new QueueRetryError();
  if (project.status !== 'active' || !project.autoAddOrganizationMembersToPortals) return;

  let portals = await db.portal.findMany({
    where: {
      id: { gt: d.cursor },
      status: 'active',
      surface: { status: 'active' },
      instance: { projectOid: project.oid }
    },
    orderBy: { id: 'asc' },
    take: batchSize,
    select: { id: true }
  });

  await reconcileOrganizationMembersManyQueue.addManyWithOps(
    portals.map(portal => ({
      data: { scope: 'portal' as const, portalId: portal.id },
      opts: { id: `portal-${portal.id}` }
    }))
  );

  if (portals.length === batchSize) {
    await reconcileOrganizationMembersManyQueue.add({
      scope: 'project',
      projectId: project.id,
      cursor: portals[portals.length - 1]!.id
    });
  }
};

let enqueueMemberPortals = async (d: { memberId: string; cursor?: string }) => {
  let member = await db.organizationMember.findUnique({
    where: { id: d.memberId },
    include: { user: true }
  });
  if (!member) throw new QueueRetryError();
  if (member.status !== 'active' || member.user.type === 'system') return;

  let portals = await db.portal.findMany({
    where: {
      id: { gt: d.cursor },
      organizationOid: member.organizationOid,
      status: 'active',
      surface: { status: 'active' },
      instance: {
        project: {
          status: 'active',
          autoAddOrganizationMembersToPortals: true
        }
      }
    },
    orderBy: { id: 'asc' },
    take: batchSize,
    select: { id: true }
  });

  await reconcileOrganizationMembersSingleQueue.addManyWithOps(
    portals.map(portal => ({
      data: { portalId: portal.id, memberId: member.id },
      opts: { id: `${portal.id}-${member.id}` }
    }))
  );

  if (portals.length === batchSize) {
    await reconcileOrganizationMembersManyQueue.add({
      scope: 'member',
      memberId: member.id,
      cursor: portals[portals.length - 1]!.id
    });
  }
};

let enqueuePortalMembers = async (d: { portalId: string; cursor?: string }) => {
  let portal = await db.portal.findUnique({
    where: { id: d.portalId },
    include: { surface: true, instance: { include: { project: true } } }
  });
  if (!portal) throw new QueueRetryError();
  if (
    portal.status !== 'active' ||
    portal.surface.status !== 'active' ||
    portal.instance.project.status !== 'active' ||
    !portal.instance.project.autoAddOrganizationMembersToPortals
  ) {
    return;
  }

  let members = await db.organizationMember.findMany({
    where: {
      id: { gt: d.cursor },
      organizationOid: portal.organizationOid,
      status: 'active',
      user: { type: { not: 'system' } }
    },
    orderBy: { id: 'asc' },
    take: batchSize,
    select: { id: true }
  });

  await reconcileOrganizationMembersSingleQueue.addManyWithOps(
    members.map(member => ({
      data: { portalId: portal.id, memberId: member.id },
      opts: { id: `${portal.id}-${member.id}` }
    }))
  );

  if (members.length === batchSize) {
    await reconcileOrganizationMembersManyQueue.add({
      scope: 'portal',
      portalId: portal.id,
      cursor: members[members.length - 1]!.id
    });
  }
};

export let reconcileOrganizationMembersManyQueueProcessor =
  reconcileOrganizationMembersManyQueue.process(async data => {
    if (data.scope === 'project') return await enqueuePortalScopes(data);
    if (data.scope === 'member') return await enqueueMemberPortals(data);
    return await enqueuePortalMembers(data);
  });

export let reconcileOrganizationMembersSingleQueueProcessor =
  reconcileOrganizationMembersSingleQueue.process(async data => {
    let [portal, member] = await Promise.all([
      db.portal.findUnique({
        where: { id: data.portalId },
        include: {
          organization: true,
          surface: true,
          instance: { include: { project: true } }
        }
      }),
      db.organizationMember.findUnique({
        where: { id: data.memberId },
        include: { user: true }
      })
    ]);
    if (!portal || !member) throw new QueueRetryError();
    if (
      portal.status !== 'active' ||
      portal.surface.status !== 'active' ||
      portal.instance.project.status !== 'active' ||
      !portal.instance.project.autoAddOrganizationMembersToPortals ||
      member.status !== 'active' ||
      member.organizationOid !== portal.organizationOid ||
      member.user.type === 'system' ||
      !member.user.email.trim()
    ) {
      return;
    }

    await consumerProfileService.ensureConsumerProfile({
      surface: portal.surface,
      name: member.user.name,
      email: member.user.email,
      user: member.user,
      auditScope: createSystemAuditScope({
        organization: portal.organization,
        job: 'portal/reconcileOrganizationMembers'
      })
    });
  });

export let reconcileOrganizationMembersProcessors = combineQueueProcessors([
  reconcileOrganizationMembersManyQueueProcessor,
  reconcileOrganizationMembersSingleQueueProcessor
]);

export let reconcileProjectOrganizationMembers = (projectId: string) =>
  reconcileOrganizationMembersManyQueue.add(
    { scope: 'project', projectId },
    { id: `project-${projectId}` }
  );

Fabric.listen('organization.member.created:after', async ({ member }) => {
  await reconcileOrganizationMembersManyQueue.add(
    { scope: 'member', memberId: member.id },
    { id: `member-${member.id}` }
  );
});

Fabric.listen('portal.created:after', async ({ portal }) => {
  await reconcileOrganizationMembersManyQueue.add(
    { scope: 'portal', portalId: portal.id },
    { id: `portal-${portal.id}` }
  );
});
