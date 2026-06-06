import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityDelegation
} from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let IdentityDelegationLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { identityDelegationId } = useParams();
  let delegation = useIdentityDelegation(instance.data?.id, identityDelegationId);

  let owner = delegation.data?.parties.find(party => party.roles.includes('owner'));
  let delegatee = delegation.data?.parties.find(party => party.roles.includes('delegatee'));

  return (
    <ContentLayout>
      <PageHeader
        title={
          owner?.actor.name && delegatee?.actor.name ? (
            <>
              {owner.actor.name} → {delegatee.actor.name}
            </>
          ) : delegation.data ? (
            'Identity Delegation'
          ) : (
            '...'
          )
        }
        pagination={[
          {
            label: 'Delegations',
            href: Paths.instance.identity.delegations(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: delegation.data?.id ?? identityDelegationId ?? '...',
            href: Paths.instance.identity.delegation(
              organization.data,
              project.data,
              instance.data,
              delegation.data?.id ?? identityDelegationId
            )
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ instance, organization, project, delegation })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
