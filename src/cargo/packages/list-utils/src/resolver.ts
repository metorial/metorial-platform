export type CargoListSelector = {
  tenant: {
    oid: bigint;
  };
  environment: {
    oid: bigint;
  };
};

export type CargoListScope = {
  tenantOid: bigint;
  environmentOid: bigint;
};

let getSelectors = (oids: bigint[]) => ({
  oids,
  in: { in: oids },
  oidIn: { oid: { in: oids } }
});

export let createResolver =
  <R extends { oid: bigint }>(
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
        tenantOid: selector.tenant.oid,
        environmentOid: selector.environment.oid
      }
    });

    return getSelectors(res.map(r => r.oid));
  };
