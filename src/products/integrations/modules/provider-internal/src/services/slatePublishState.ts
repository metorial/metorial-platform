import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';

class SlatePublishStateServiceImpl {
  async getPublishState(d: { slateVersionIds: string[] }) {
    if (!d.slateVersionIds.length) return [];

    let versions = await db.slateVersion.findMany({
      where: { id: { in: d.slateVersionIds } },
      include: {
        providerVersions: {
          orderBy: { createdAt: 'desc' },
          include: { providerVariant: { select: { currentVersionOid: true } } }
        }
      }
    });
    let versionsById = new Map(versions.map(v => [v.id, v]));

    return d.slateVersionIds.map(slateVersionId => {
      let version = versionsById.get(slateVersionId);
      let providerVersion = version?.providerVersions[0];

      return {
        slateVersionId,
        pulledAt: version?.createdAt ?? null,
        providerVersionId: providerVersion?.id ?? null,
        isCurrent: providerVersion
          ? providerVersion.providerVariant.currentVersionOid === providerVersion.oid
          : false,
        specificationDiscoveryStatus: providerVersion?.specificationDiscoveryStatus ?? null
      };
    });
  }
}

export let slatePublishStateService = Service.create(
  'slatePublishStateService',
  () => new SlatePublishStateServiceImpl()
).build();
