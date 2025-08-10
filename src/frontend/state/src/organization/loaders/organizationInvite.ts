import { createLoader } from '@metorial/data-hooks';
import { useEffect, useState } from 'react';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let organizationInvitesLoader = createLoader({
  name: 'organizationInvites',
  fetch: (i: { organizationId: string; after?: string; before?: string }) =>
    withAuth(sdk =>
      sdk.organizations.invites.list(i.organizationId, {
        after: i.after,
        before: i.before,
        limit: 100
      })
    ),
  mutators: {
    createByEmail: (
      i: {
        email: string;
        message?: string;
        role: 'member' | 'admin';
      },
      { input: { organizationId } }
    ) =>
      withAuth(sdk =>
        sdk.organizations.invites.create(organizationId, {
          type: 'email',
          email: i.email,
          role: i.role,
          message: i.message
        })
      ),

    delete: (i: { organizationInviteId: string }, { input: { organizationId } }) =>
      withAuth(sdk => sdk.organizations.invites.delete(organizationId, i.organizationInviteId))
  }
});

export let useOrganizationInvites = (organizationId: string | null) => {
  let member = usePaginator(cursor =>
    organizationInvitesLoader.use(organizationId ? { organizationId, ...cursor } : null)
  );

  return {
    ...member,
    createByEmailMutator: member.useMutator('createByEmail'),
    deleteMutator: member.useMutator('delete')
  };
};

export let useOrganizationInviteLink = (organizationId: string | null) => {
  let [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (url || !organizationId) return;

    (async () => {
      let res = await withAuth(sdk => sdk.organizations.invites.ensureLink(organizationId));
      console.log('Organization invite link:', res);

      setUrl(res.inviteLink.url);
    })().catch(console.error);
  }, [url, organizationId]);

  return url;
};
