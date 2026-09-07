import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { Slate, SlateInstance, SlateTriggerGroup } from '../../prisma/generated/client';
import { db } from '../db';

export let getActiveSlateVersion = async (d: {
  slate: Slate;
  instance?: Pick<SlateInstance, 'lockedSlateVersionOid'> | null;
}) => {
  let versionOid = d.instance?.lockedSlateVersionOid ?? d.slate.currentVersionOid;
  if (!versionOid) {
    throw new ServiceError(
      badRequestError({ message: 'Provider does not have a current version set.' })
    );
  }

  let fullVersion = await db.slateVersion.findFirstOrThrow({
    where: { slateOid: d.slate.oid, oid: versionOid }
  });
  if (fullVersion.status !== 'active' || !fullVersion.activeDeploymentOid) {
    throw new ServiceError(
      badRequestError({ message: 'Provider version has not been deployed yet.' })
    );
  }

  return fullVersion;
};

export let getLatestSlateVersionSupportingTriggerGroup = async (d: {
  slate: Slate;
  triggerGroup: SlateTriggerGroup;
}) => {
  let version = await db.slateVersion.findFirst({
    where: {
      slateOid: d.slate.oid,
      status: 'active',
      activeDeploymentOid: { not: null },
      specification: {
        slateTriggerGroups: { some: { triggerGroupOid: d.triggerGroup.oid } }
      }
    },
    orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }]
  });

  if (!version) {
    throw new ServiceError(
      badRequestError({
        message: `No deployed provider version supports trigger group "${d.triggerGroup.key}".`
      })
    );
  }

  return version;
};
