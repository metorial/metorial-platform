import { renderWithLoader } from '@metorial/data-hooks';
import { SetupLayout } from '@metorial/layout';
import { useOrganizationInviteAccept } from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import astronaut from '../../../assets/astronaut_waving1.webp';

export let OrganizationInvitePage = () => {
  let [params] = useSearchParams();
  let inviteKey = params.get('invite_key');

  let [state, setState] = useState<'home' | 'rejected'>('home');

  let invite = useOrganizationInviteAccept(inviteKey);

  let acceptMutation = invite.acceptMutator();
  let rejectMutation = invite.rejectMutator();

  return (
    <SetupLayout
      main={{
        title: `Join ${invite.data?.organization?.name ?? '...'}`,
        description: 'Join your team and start collaborating.'
      }}
      imageUrl={astronaut}
    >
      {state == 'home' &&
        renderWithLoader({ invite })(({ invite }) => (
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
