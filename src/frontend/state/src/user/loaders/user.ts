import { createLoader } from '@metorial/data-hooks';
import { fetchUserSpecial, withAuth } from '../auth/withAuth';

export let userLoader = createLoader({
  name: 'user',
  fetch: () => fetchUserSpecial(),
  mutators: {
    update: (i: {
      firstName?: string;
      lastName?: string;
      name?: string;
      imageFileId?: string | null;
    }) => withAuth(sdk => sdk.user.update(i))

    // delete: (i: {
    //   firstName?: string;
    //   lastName?: string;
    //   name?: string;
    //   imageFileId?: string | null;
    // }) => withAuth(sdk => sdk.user.delete(i))
  }
});

export let firstUserLoad = userLoader.fetchAndReturn();

export let useUser = () => {
  let user = userLoader.use();

  return {
    ...user,

    updateMutator: user.useMutator('update')

    // deleteMutator: user.useMutator('delete')
  };
};
