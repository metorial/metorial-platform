import { db, type Prisma } from '@metorial/db';
import { appendSkillDestinationSyncLog } from './logs';

let activeSkillDestinationOwners = [
  { skillMarketplace: { status: 'active' } },
  { skillPlugin: { status: 'active' } }
] satisfies Prisma.SkillDestinationWhereInput[];

export let activeSkillDestinationOwnerWhere = {
  OR: activeSkillDestinationOwners
} satisfies Prisma.SkillDestinationWhereInput;

export let skillDestinationSyncEligibleWhere = {
  OR: [{ storageMode: 'code_bucket' }, ...activeSkillDestinationOwners]
} satisfies Prisma.SkillDestinationWhereInput;

export let hasActiveSkillDestinationOwner = (destination: {
  skillMarketplace: { status: string } | null;
  skillPlugin: { status: string } | null;
}) =>
  destination.skillMarketplace?.status === 'active' ||
  destination.skillPlugin?.status === 'active';

export let cancelInactiveManifestSync = async (sync: {
  oid: bigint;
  id: string;
  destination: Parameters<typeof hasActiveSkillDestinationOwner>[0] & { storageMode: string };
}) => {
  if (
    sync.destination.storageMode !== 'manifest' ||
    hasActiveSkillDestinationOwner(sync.destination)
  )
    return false;

  await db.skillDestinationSync.update({
    where: { oid: sync.oid },
    data: { status: 'canceled', completedAt: new Date() }
  });
  await appendSkillDestinationSyncLog(
    sync.id,
    'Sync canceled because this destination has no active marketplace or plugin.'
  );

  return true;
};
