export type SessionAdapterScope = {
  isInternal: boolean;
  adapterGlobalOid: bigint | null;
};

export let getProviderActionAdapterWhere = (session: SessionAdapterScope) => {
  if (!session.isInternal) return { adapterOid: null } as const;
  if (!session.adapterGlobalOid) {
    throw new Error('Internal session is missing its adapter binding');
  }

  return { adapter: { globalOid: session.adapterGlobalOid } } as const;
};
