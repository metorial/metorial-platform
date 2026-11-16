import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';
import { syncSlateVersionQueue } from '../queues/sync/syncSlateVersion';

class AdminSlateSyncServiceImpl {
  async syncProvider(d: { providerId: string }) {
    let provider = await db.provider.findUnique({
      where: { id: d.providerId },
      include: {
        variants: {
          where: { slateOid: { not: null } },
          include: { slate: true, currentVersion: { include: { slateVersion: true } } }
        }
      }
    });
    if (!provider) throw new ServiceError(notFoundError('provider', d.providerId));

    let versions = provider.variants.flatMap(variant =>
      variant.slate && variant.currentVersion?.slateVersion
        ? [
            {
              slateId: variant.slate.id,
              slateVersionId: variant.currentVersion.slateVersion.id
            }
          ]
        : []
    );
    if (!versions.length) {
      throw new ServiceError(
        badRequestError({ message: 'This provider has no slate version to sync' })
      );
    }

    await syncSlateVersionQueue.addManyWithOps(
      versions.map(data => ({ data, opts: { id: data.slateVersionId } }))
    );

    return { success: true };
  }
}

export let adminSlateSyncService = Service.create(
  'adminSlateSyncService',
  () => new AdminSlateSyncServiceImpl()
).build();
