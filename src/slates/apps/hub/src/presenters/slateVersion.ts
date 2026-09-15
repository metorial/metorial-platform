import { shadowId } from '@lowerdeck/shadow-id';
import type {
  Adapter,
  SlateAdapter,
  Slate,
  SlateSpecification,
  SlateVersion,
  SlateVersionAdapter,
  SlateVersionAdapterCapability,
  AdapterCapability
} from '../../prisma/generated/client';
import { slateVersionAdapterPresenter } from './adapter';

export let slateVersionPresenter = (
  slateVersion: SlateVersion & {
    slate: Slate;
    specification: SlateSpecification | null;
    slateVersionAdapters?: (SlateVersionAdapter & {
      slateAdapter: SlateAdapter & { adapter: Adapter };
      slateVersionAdapterCapabilities: (SlateVersionAdapterCapability & {
        adapterCapability: AdapterCapability;
      })[];
    })[];
  }
) => ({
  object: 'slate.version',

  id: slateVersion.id,

  status: slateVersion.status,
  version: slateVersion.version,
  isCurrent: slateVersion.isCurrent,

  slateId: slateVersion.slate.id,

  manifest: slateVersion.manifest,

  adapters: slateVersion.slateVersionAdapters?.map(slateVersionAdapterPresenter) ?? [],

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
