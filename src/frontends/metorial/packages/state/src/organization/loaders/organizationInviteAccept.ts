import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let organizationInviteAcceptLoader = createLoader({
  name: 'organizationInviteAccept',
  fetch: (i: { inviteKey: string }) =>
    withAuth(sdk =>
      sdk.organizationJoins.get({
        inviteKey: i.inviteKey
      })
    ),
  mutators: {
    accept: (i: void, { input: { inviteKey } }) =>
      withAuth(sdk =>
        sdk.organizationJoins.accept({
          inviteKey
        })
      ),

    reject: (i: void, { input: { inviteKey } }) =>
      withAuth(sdk =>
        sdk.organizationJoins.reject({
          inviteKey
        })
      )
  }
});

export let useOrganizationInviteAccept = (inviteKey: string | null) => {
  let invite = organizationInviteAcceptLoader.use(inviteKey ? { inviteKey } : null);

  return {
    ...invite,
    acceptMutator: invite.useMutator('accept'),
    rejectMutator: invite.useMutator('reject')
  };
};
