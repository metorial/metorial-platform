import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { Slate } from '../../prisma/generated/client';
import { db } from '../db';

export let getActiveSlateVersion = async (d: { slate: Slate }) => {
  if (!d.slate.currentVersionOid) {
    throw new ServiceError(
      badRequestError({ message: 'Provider does not have a current version set.' })
    );
  }

  let fullVersion = await db.slateVersion.findFirstOrThrow({
    where: { slateOid: d.slate.oid, oid: d.slate.currentVersionOid }
  });
  if (fullVersion.status !== 'active' || !fullVersion.activeDeploymentOid) {
    throw new ServiceError(
      badRequestError({ message: 'Provider version has not been deployed yet.' })
    );
  }

  return fullVersion;
};
