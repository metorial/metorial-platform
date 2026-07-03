import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { db } from '../db';
import { ID, snowflake } from '../id';
import {
  byValueThenId,
  getChangedSsoUserFields,
  type SsoUserChangeSnapshot
} from './recordSsoUserChangeSnapshot';

let redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let isUniqueConstraintError = (error: unknown) => (error as any)?.code === 'P2002';

export type SsoUserChangeSource =
  | 'user_upserted'
  | 'owner_profile_changed'
  | 'user_reconciled'
  | 'directory_user_changed'
  | 'directory_user_deleted'
  | 'directory_group_membership_changed'
  | 'directory_group_deleted'
  | 'profile_group_role_membership_reconciled';

export let recordSsoUserChangeQueue = createQueue<{
  changeId: string;
  ssoUserId: string;
  source: SsoUserChangeSource;
  changedAt: string;
  snapshot: SsoUserChangeSnapshot;
  scimOperationId?: string;
}>({
  name: 'ares/sso/user/change',
  redisUrl,
  workerOpts: { concurrency: 1 }
});

export let buildSsoUserChangeSnapshot = async (ssoUserId: string) => {
  let user = await db.ssoUser.findUnique({
    where: { id: ssoUserId },
    include: {
      ownerProfile: true,
      groupLinks: { include: { group: true } },
      roleLinks: { include: { role: true } }
    }
  });

  if (!user) return null;

  let assignedGroups = user.groupLinks
    .map(link => ({
      id: link.group.id,
      value: link.group.value,
      displayName: link.group.displayName
    }))
    .sort(byValueThenId);

  let assignedRoles = user.roleLinks
    .map(link => ({
      id: link.role.id,
      value: link.role.value,
      displayName: link.role.displayName
    }))
    .sort(byValueThenId);

  return {
    user: {
      id: user.id,
      oid: user.oid.toString(),
      tenantOid: user.tenantOid.toString(),
      status: user.status,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      ownerProfileOid: user.ownerProfileOid?.toString() ?? null
    },
    ownerProfile: user.ownerProfile
      ? {
          id: user.ownerProfile.id,
          oid: user.ownerProfile.oid.toString(),
          status: user.ownerProfile.status,
          email: user.ownerProfile.email,
          firstName: user.ownerProfile.firstName,
          lastName: user.ownerProfile.lastName
        }
      : null,
    assignedGroups,
    assignedRoles
  } satisfies SsoUserChangeSnapshot;
};

export let enqueueSsoUserChange = async (d: {
  ssoUserId: string;
  source: SsoUserChangeSource;
  scimOperationId?: string;
}) => {
  let snapshot = await buildSsoUserChangeSnapshot(d.ssoUserId);
  if (!snapshot) return;

  let changeId = ID.generateIdSync('ssoUserChange');

  await recordSsoUserChangeQueue.addManyWithOps([
    {
      data: {
        changeId,
        ssoUserId: d.ssoUserId,
        source: d.source,
        changedAt: new Date().toISOString(),
        snapshot,
        scimOperationId: d.scimOperationId
      },
      opts: { id: changeId }
    }
  ]);
};

export let recordSsoUserChangeQueueProcessor = recordSsoUserChangeQueue.process(async data => {
  let latestChange = await db.ssoUserChange.findFirst({
    where: { userId: data.snapshot.user.id },
    orderBy: { createdAt: 'desc' }
  });

  let previousSnapshot =
    (latestChange?.snapshot as SsoUserChangeSnapshot | null | undefined) ?? null;
  let changedFields = getChangedSsoUserFields(previousSnapshot, data.snapshot);
  if (changedFields.length === 0) return;

  let currentUser = await db.ssoUser.findUnique({
    where: { id: data.snapshot.user.id },
    select: { oid: true }
  });

  let scimOperation = data.scimOperationId
    ? await db.ssoScimOperation.findUnique({
        where: { id: data.scimOperationId },
        select: { oid: true }
      })
    : null;

  try {
    await db.ssoUserChange.create({
      data: {
        oid: snowflake.nextId(),
        id: data.changeId,
        tenantOid: BigInt(data.snapshot.user.tenantOid),
        userOid: currentUser?.oid ?? null,
        userId: data.snapshot.user.id,
        status: data.snapshot.user.status as any,
        email: data.snapshot.user.email,
        firstName: data.snapshot.user.firstName,
        lastName: data.snapshot.user.lastName,
        ownerProfileOid: data.snapshot.user.ownerProfileOid
          ? BigInt(data.snapshot.user.ownerProfileOid)
          : null,
        source: data.source,
        changedFields,
        scimOperationOid: scimOperation?.oid ?? null,
        assignedGroups: data.snapshot.assignedGroups,
        assignedRoles: data.snapshot.assignedRoles,
        snapshot: data.snapshot,
        createdAt: new Date(data.changedAt)
      }
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }
});

export let recordSsoUserChangesProcessor = combineQueueProcessors([
  recordSsoUserChangeQueueProcessor
]);
