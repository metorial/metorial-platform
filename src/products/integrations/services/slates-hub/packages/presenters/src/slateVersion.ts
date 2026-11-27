import { shadowId } from '@lowerdeck/shadow-id';
import type {
  Adapter,
  SlateAdapter,
  Slate,
  SlateDeployment,
  SlateSpecification,
  SlateVersion,
  SlateVersionAdapter,
  SlateVersionAdapterCapability,
  AdapterCapability
} from '@mtsrc/slates-hub-db/client';
import { slateVersionAdapterPresenter } from './adapter';
import { slateDeploymentLightPresenter } from './slateDeployment';

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
    slateDeployments?: SlateDeployment[];
  }
) => ({
  object: 'slate.version',

  id: slateVersion.id,

  status: slateVersion.status,
  version: slateVersion.version,
  isCurrent: slateVersion.isCurrent,
  willBeCurrent: slateVersion.willBeCurrent,

  slateId: slateVersion.slate.id,
  registrySlateId: slateVersion.slate.slateIdOnRegistry,
  registryVersionId: slateVersion.versionIdOnRegistry,

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

  latestDeployment: slateVersion.slateDeployments?.[0]
    ? slateDeploymentLightPresenter(slateVersion.slateDeployments[0])
    : null,

  createdAt: slateVersion.createdAt,
  updatedAt: slateVersion.updatedAt,
  lastDiscoveredAt: slateVersion.lastDiscoveredAt
});
