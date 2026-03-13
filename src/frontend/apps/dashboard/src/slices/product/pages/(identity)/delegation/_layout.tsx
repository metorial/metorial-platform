import { renderWithLoader } from '@metorial/data-hooks';
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

  return renderWithLoader({ instance, organization, project, delegation })(
    ({ instance, organization, project, delegation }) => (
      <ContentLayout>
        <PageHeader
          title={delegation.data.id}
          description={delegation.data.note ?? undefined}
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
              label: delegation.data.id,
              href: Paths.instance.identity.delegation(
                organization.data,
                project.data,
                instance.data,
                delegation.data.id
              )
            }
          ]}
        />

        <Outlet />
      </ContentLayout>
    )
  );
};
