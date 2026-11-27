import { type Callback, db } from '@metorial-subspace/db';

export type CallbackOwner =
  | { ownership: 'user'; managedAdapterGlobalOid: null; name: null }
  | { ownership: 'managed'; managedAdapterGlobalOid: bigint; name: string };

export let userCallbackOwner: CallbackOwner = {
  ownership: 'user',
  managedAdapterGlobalOid: null,
  name: null
};

export let isOwnedBy = (
  callback: Pick<Callback, 'ownership' | 'managedAdapterGlobalOid'>,
  owner: CallbackOwner
) =>
  callback.ownership === owner.ownership &&
  callback.managedAdapterGlobalOid === owner.managedAdapterGlobalOid;

export let listManagedCallbackOwners = async (d: {
  integrationProviderOid: bigint;
}): Promise<CallbackOwner[]> => {
  let adapterIntegrationProviders = await db.adapterIntegrationProvider.findMany({
    where: {
      integrationProviderOid: d.integrationProviderOid,
      status: 'active',
      adapterIntegration: { status: 'active' }
    },
    select: {
      adapterIntegration: {
        select: { adapterGlobal: { select: { oid: true, name: true } } }
      }
    }
  });

  let byOid = new Map<bigint, string>();
  for (let adapterIntegrationProvider of adapterIntegrationProviders) {
    let adapterGlobal = adapterIntegrationProvider.adapterIntegration.adapterGlobal;
    byOid.set(adapterGlobal.oid, adapterGlobal.name);
  }

  return [...byOid].map(([oid, name]) => ({
    ownership: 'managed' as const,
    managedAdapterGlobalOid: oid,
    name
  }));
};
