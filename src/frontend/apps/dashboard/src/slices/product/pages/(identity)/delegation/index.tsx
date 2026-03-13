import { renderWithLoader } from '@metorial/data-hooks';
import { DashboardInstanceIdentitiesDelegationsGetOutput } from '@metorial/dashboard-sdk';
import { useCurrentInstance, useIdentityDelegation } from '@metorial/state';
import { Attributes, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

let getPartyName = (
  parties: DashboardInstanceIdentitiesDelegationsGetOutput['parties'],
  role: 'owner' | 'delegatee' | 'delegator'
) => {
  return parties.find(party => party.roles.includes(role))?.actor.name ?? '—';
};

export let IdentityDelegationPage = () => {
  let instance = useCurrentInstance();
  let { identityDelegationId } = useParams();
  let delegation = useIdentityDelegation(instance.data?.id, identityDelegationId);

  return renderWithLoader({ delegation })(({ delegation }) => (
    <Attributes
      itemWidth="240px"
      attributes={[
        {
          label: 'ID',
          content: <ID id={delegation.data.id} />
        },
        {
          label: 'Status',
          content: delegation.data.status
        },
        {
          label: 'Owner',
          content: getPartyName(delegation.data.parties, 'owner')
        },
        {
          label: 'Delegator',
          content: getPartyName(delegation.data.parties, 'delegator')
        },
        {
          label: 'Delegatee',
          content: getPartyName(delegation.data.parties, 'delegatee')
        },
        {
          label: 'Identity ID',
          content: <ID id={delegation.data.identityId} />
        },
        {
          label: 'Permissions',
          content: delegation.data.permissions.join(', ')
        },
        {
          label: 'Created At',
          content: <RenderDate date={delegation.data.createdAt} />
        },
        {
          label: 'Expires At',
          content: delegation.data.expiresAt ? (
            <RenderDate date={delegation.data.expiresAt} />
          ) : (
            '—'
          )
        }
      ]}
    />
  ));
};
