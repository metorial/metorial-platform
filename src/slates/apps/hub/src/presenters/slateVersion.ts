import { shadowId } from '@lowerdeck/shadow-id';
import type { Slate, SlateSpecification, SlateVersion } from '../../prisma/generated/client';

export let slateVersionPresenter = (
  slateVersion: SlateVersion & {
    slate: Slate;
    specification: SlateSpecification | null;
  }
) => ({
  object: 'slate.version',

  id: slateVersion.id,

  status: slateVersion.status,
  version: slateVersion.version,
  isCurrent: slateVersion.isCurrent,

  slateId: slateVersion.slate.id,

  manifest: slateVersion.manifest,

  specification: slateVersion.specification
    ? {
        object: 'slate.version.specification',

        id: shadowId('shsvsp_', [slateVersion.id], [slateVersion.specification.id]),
        versionId: slateVersion.id,
        specificationId: slateVersion.specification.id,

        identifier: slateVersion.specification.identifier,

        createdAt: slateVersion.specification.createdAt
      }
    : null,

  createdAt: slateVersion.createdAt
});
