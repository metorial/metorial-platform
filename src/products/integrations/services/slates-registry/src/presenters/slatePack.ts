import type { SlatePackRelease } from '../../prisma/generated/client';
import { env } from '../env';

export let getSlatePackReleaseDownloadUrl = (d: { subRegistryId: string; releaseId: string }) =>
  new URL(
    `/slate-packs/channels/${encodeURIComponent(d.subRegistryId)}/releases/${d.releaseId}/download`,
    env.url.SERVICE_PUBLIC_URL
  ).toString();

export let slatePackReleasePresenter = (
  release: SlatePackRelease,
  o: { subRegistryId: string }
) => ({
  object: 'slates_registry.slate_pack.release',

  id: release.id,
  kind: release.kind,

  sequence: release.sequence,
  fullSyncId: release.fullSyncId,
  part: release.part,
  partCount: release.partCount,
  coversSequence: release.coversSequence,

  fileName: release.fileName,
  entryCount: release.entryCount,
  size: Number(release.size),
  sha256: release.sha256,
  downloadUrl: getSlatePackReleaseDownloadUrl({
    subRegistryId: o.subRegistryId,
    releaseId: release.id
  }),

  createdAt: release.createdAt
});
