import { createLoader } from '@metorial/data-hooks';
import { useCallback, useMemo } from 'react';
import { withAuth } from '../../user';
import { useCurrentOrganization } from '../current';

export let flagsLoader = createLoader({
  name: 'flags',
  parents: [],
  fetch: (i: { organizationIds: string[] }) =>
    withAuth(sdk =>
      Promise.all(
        i.organizationIds.map(async organizationId => {
          let r = await sdk.organizations.flags.get(organizationId);

          return {
            organizationId,
            flags: Object.fromEntries(r.flags.map(f => [f.slug, f.value]))
          };
        })
      )
    ),
  mutators: {}
});

export let useDashboardFlags = () => {
  let current = useCurrentOrganization();
  let res = flagsLoader.use(
    useMemo(
      () => (current.data ? { organizationIds: [current.data.id] } : null),
      [current.data?.id]
    )
  );

  let data = res.data ? res.data[0] : null;

  let useFlag = useCallback(
    (flag: string) => data?.flags[flag as keyof typeof data.flags] ?? null,
    [data]
  );

  return {
    ...res,
    data,
    useFlag
  };
};

export let useDashboardFlagForManyOrgs = (
  i: {
    organizationIds?: string[];
  } | null
) => {
  let data = flagsLoader.use(
    useMemo(
      () => (i?.organizationIds ? { organizationIds: i.organizationIds } : null),
      [i?.organizationIds?.join(',')]
    )
  );

  return data;
};
