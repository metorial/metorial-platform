import { db } from '@metorial/db';
import { getFlags, isFlagEnabled } from '@metorial/module-flags';

export type StoreResourceFlag = 'store-participants-v2' | 'store-access-v2';

export let isStoreResourceFlagEnabled = async (d: {
  project: { oid: bigint };
  flag: StoreResourceFlag;
}) => {
  let project = await db.project.findUnique({
    where: { oid: d.project.oid },
    include: { organization: true }
  });
  if (!project) return false;

  let flags = await getFlags({ organization: project.organization, project });

  return isFlagEnabled(flags[d.flag]);
};
