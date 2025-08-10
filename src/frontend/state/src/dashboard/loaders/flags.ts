import { createLoader } from '@metorial/data-hooks';
import { useCurrentOrganization } from '../../organization';
import { withAuthPrivate } from '../../user/auth/withAuth';

export let flagsLoader = createLoader({
  name: 'dashboard_flags',
  parents: [],
  fetch: (i: { organizationId: string }) =>
    withAuthPrivate(i, c =>
      c
        .query({
          getFlags: {
            __scalar: true,
            flags: { __scalar: true },
            organization: { __scalar: true }
          }
        })
        .then(r => r.getFlags)
    ),
  mutators: {}
});

export let useDashboardFlags = () => {
  let current = useCurrentOrganization();
  let data = flagsLoader.use(current.data ? { organizationId: current.data.id } : null);

  return data;
};
