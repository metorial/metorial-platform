import { createLoader } from '@metorial/data-hooks';
import type { Flags } from '@metorial/module-flags';
import { useMemo } from 'react';
import { useCurrentOrganization } from '../../organization';
import { withAuthPrivate } from '../../user/auth/withAuth';

export let flagsLoader = createLoader({
  name: 'dashboard_flags',
  parents: [],
  fetch: (i: { organizationIds: string[] }) =>
    Promise.all(
      i.organizationIds.map(async organizationId =>
        withAuthPrivate(
          {
            organizationId
          },
          c =>
            c
              .query({
                getFlags: {
                  __scalar: true,
                  flags: { __scalar: true },
                  organization: { __scalar: true }
                }
              })
              .then(r => ({
                ...r.getFlags,
                flags: Object.fromEntries(
                  r.getFlags.flags.map(f => [f.slug, f.value])
                ) as any as Flags
              }))
        )
      )
    ),
  mutators: {}
});

export let useDashboardFlags = () => {
  let current = useCurrentOrganization();
  let data = flagsLoader.use(
    useMemo(
      () => (current.data ? { organizationIds: [current.data.id] } : null),
      [current.data?.id]
    )
  );

  return {
    ...data,
    data: data.data ? data.data[0] : null
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
