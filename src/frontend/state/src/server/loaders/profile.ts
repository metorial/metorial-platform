import { DashboardInstanceCustomServersUpdateBody } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let profileLoader = createLoader({
  name: 'profile',
  parents: [],
  fetch: (i: { organizationId: string }) => withAuth(sdk => sdk.profile.get(i.organizationId)),
  mutators: {
    update: (i: DashboardInstanceCustomServersUpdateBody, { input: { organizationId } }) =>
      withAuth(sdk => sdk.profile.update(organizationId, i))
  }
});

export let useProfile = (organizationId: string | null | undefined) => {
  let data = profileLoader.use(organizationId ? { organizationId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
