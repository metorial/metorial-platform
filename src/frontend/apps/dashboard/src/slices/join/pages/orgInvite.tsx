import { renderWithLoader } from '@metorial/data-hooks';
import { SetupLayout } from '@metorial/layout';
import { useOrganizationInviteAccept, useOrganizations } from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import bg from '../../../assets/bg.webp';
import bubbles from '../../../assets/bubbles.svg';

export let OrganizationInvitePage = () => {
  let [params] = useSearchParams();
  let inviteKey = params.get('invite_key');

  let [state, setState] = useState<'home' | 'rejected'>('home');

  let invite = useOrganizationInviteAccept(inviteKey);
  let orgs = useOrganizations();

  let acceptMutation = invite.acceptMutator();
  let rejectMutation = invite.rejectMutator();

  let hasOrg = !!orgs.data?.some(org => org.id == invite.data?.organization.id);

  useEffect(() => {
    if (hasOrg) window.location.replace(`/?organization_id=${invite.data?.organization.id}`);
  }, [hasOrg]);

  return (
    <SetupLayout
      main={{
        title: `Join ${invite.data?.organization?.name ?? '...'}`,
        description: 'Join your team and start collaborating.'
      }}
      bubblesUrl={bubbles}
      backgroundUrl={bg}
    >
      {state == 'home' &&
        renderWithLoader({ invite, hasOrg })(({ invite }) => (
          <div
            style={{
              display: 'flex',
              gap: 15,
              flexWrap: 'wrap'
            }}
          >
            <Button
              fullWidth
              loading={acceptMutation.isLoading}
              disabled={rejectMutation.isLoading}
              success={acceptMutation.isSuccess}
              onClick={async () => {
                let [res] = await acceptMutation.mutate();
                if (res)
                  window.location.replace(`/?organization_id=${invite.data?.organization.id}`);
              }}
            >
              Accept
            </Button>
            <Button
              fullWidth
              variant="soft"
              onClick={async () => {
                let [res] = await rejectMutation.mutate();
                if (res) setState('rejected');
              }}
            >
              Reject
            </Button>
          </div>
        ))}

      {state == 'rejected' && (
        <div>
          <p>Your invitation has been rejected. You may click the link again to accept.</p>

          <Spacer height={15} />

          <Button
            onClick={() => {
              setState('home');
            }}
            fullWidth
            variant="soft"
          >
            Changed your mind?
          </Button>
        </div>
      )}
    </SetupLayout>
  );
};
