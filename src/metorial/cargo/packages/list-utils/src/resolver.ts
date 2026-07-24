export type CargoListSelector = {
  resourceTenant: {
    oid: bigint;
  };
  resourceGroup: {
    oid: bigint;
  };
};

export type CargoListScope = {
  resourceTenantOid: bigint;
  resourceGroupOid: bigint;
};

let getSelectors = <O extends number | bigint>(oids: O[]) => ({
  oids,
  in: { in: oids },
  oidIn: { oid: { in: oids } }
});

let createResolverForOid =
  <O extends number | bigint>() =>
  <R extends { oid: O }>(
    cb: (d: {
      selector: CargoListSelector;
      scope: CargoListScope;
      ids: string[];
    }) => Promise<R[]>
  ) =>
  async (selector: CargoListSelector, ids: string[] | undefined | null) => {
    if (!ids) return undefined;

    if (ids.length === 0) return getSelectors([]);

    let res = await cb({
      ids,
      selector,
      scope: {
        resourceTenantOid: selector.resourceTenant.oid,
        resourceGroupOid: selector.resourceGroup.oid
      }
    });

    return getSelectors(res.map(r => r.oid));
  };

export let createResolver = createResolverForOid<bigint>();
export let createNumberResolver = createResolverForOid<number>();
