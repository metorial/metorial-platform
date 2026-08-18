import type {
  Adapter,
  AdapterCapability,
  SlateAdapter,
  SlateVersionAdapter,
  SlateVersionAdapterCapability
} from '../../prisma/generated/client';

export let adapterPresenter = (adapter: Adapter, slateIdentifier: string) => ({
  object: 'slate.adapter',

  id: adapter.id,
  identifier: adapter.identifier,
  slateIdentifier,
  name: adapter.name,

  createdAt: adapter.createdAt,
  updatedAt: adapter.updatedAt
});

export let slateVersionAdapterPresenter = (
  slateVersionAdapter: SlateVersionAdapter & {
    slateAdapter: SlateAdapter & { adapter: Adapter };
    slateVersionAdapterCapabilities: (SlateVersionAdapterCapability & {
      adapterCapability: AdapterCapability;
    })[];
  }
) => ({
  ...adapterPresenter(
    slateVersionAdapter.slateAdapter.adapter,
    slateVersionAdapter.slateAdapter.identifier
  ),
  capabilities: slateVersionAdapter.slateVersionAdapterCapabilities.map(capability => ({
    id: capability.adapterCapability.identifier,
    value: capability.value
  }))
});
