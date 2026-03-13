import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentity
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let IdentityLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { identityId } = useParams();
  let identity = useIdentity(instance.data?.id, identityId);
  let pathname = useLocation().pathname;

  return renderWithLoader({ instance, organization, project, identity })(
    ({ instance, organization, project, identity }) => (
      <ContentLayout>
        <PageHeader
          title={identity.data.name ?? identity.data.id}
          description={identity.data.description ?? undefined}
          pagination={[
            {
              label: 'Identities',
              href: Paths.instance.identity.identities(
                organization.data,
                project.data,
                instance.data
              )
            },
            {
              label: identity.data.name ?? identity.data.id,
              href: Paths.instance.identity.identity(
                organization.data,
                project.data,
                instance.data,
                identity.data.id
              )
            }
          ]}
        />

        <LinkTabs
          current={pathname}
          links={[
            {
              label: 'Overview',
              to: Paths.instance.identity.identity(
                organization.data,
                project.data,
                instance.data,
                identity.data.id
              )
            },
            {
              label: 'Delegations',
              to: Paths.instance.identity.identity(
                organization.data,
                project.data,
                instance.data,
                identity.data.id,
                'delegations'
              )
            },
            {
              label: 'Delegation Requests',
              to: Paths.instance.identity.identity(
                organization.data,
                project.data,
                instance.data,
                identity.data.id,
                'delegation-requests'
              )
            },
            {
              label: 'Settings',
              to: Paths.instance.identity.identity(
                organization.data,
                project.data,
                instance.data,
                identity.data.id,
                'settings'
              )
            }
          ]}
        />

        <Outlet />
      </ContentLayout>
    )
  );
};
