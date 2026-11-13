import { useCurrentInstance, useSkillMarketplaces } from '@metorial/state';
import { useMemo } from 'react';

let sidebarMarketplacesLimit = 20;

export let useSkillMarketplacesNav = (opts: { enabled: boolean }) => {
  let instance = useCurrentInstance();
  let marketplaces = useSkillMarketplaces(opts.enabled ? instance.data?.id : null, {
    order: 'asc',
    status: ['active'],
    limit: sidebarMarketplacesLimit
  });

  return useMemo(
    () => (marketplaces.data?.items ?? []).map(m => ({ id: m.id, name: m.name })),
    [marketplaces.data]
  );
};
