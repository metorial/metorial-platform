import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePortalConsumerGroups,
  usePortal
} from '@metorial/state';
import { Badge, Button, Callout, LinkTabs, Spacer } from '@metorial/ui';
import { RiExternalLinkLine } from '@remixicon/react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { showConsumerGroupFormModal } from '../../scenes/portals/groupsTable';

export let PortalLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { portalId } = useParams();
  let portal = usePortal(instance.data?.id, portalId);
  let pathname = useLocation().pathname;

  if (pathname.includes('/group/')) pathname = pathname.split('/group/')[0] + '/groups';
  if (pathname.includes('/user/')) pathname = pathname.split('/user/')[0] + '/users';
  if (pathname.includes('/settings/'))
    pathname = pathname.split('/settings/')[0] + '/settings';

  let groups = usePortalConsumerGroups(
    instance.data?.id,
    pathname.endsWith('/groups') ? portalId : null,
    { limit: 50 }
  );

  return renderWithLoader({ instance, organization, project, portal })(
    ({ instance, organization, project, portal }) => (
      <ContentLayout>
        <PageHeader
          title={portal.data.name}
          description={portal.data.description || 'No description'}
          top={<Badge color="gray">{portal.data.status}</Badge>}
          pagination={[
            {
              label: 'Portals',
              href: Paths.instance.portals(organization.data, project.data, instance.data)
            },
            {
              label: portal.data.name,
              href: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id
              )
            }
          ]}
          actions={
            <>
              {portal.data.urls[0]?.url && (
                <a href={portal.data.urls[0].url} target="_blank" rel="noopener noreferrer">
                  <Button as="span" iconRight={<RiExternalLinkLine />} size="2">
                    Open Portal
                  </Button>
                </a>
              )}

              {pathname.endsWith('/groups') && (
                <Button
                  size="2"
                  onClick={() =>
                    showConsumerGroupFormModal({
                      instanceId: instance.data.id,
                      portalId: portal.data.id,
                      onCreate: () => groups.refetch()
                    })
                  }
                >
                  Create Group
                </Button>
              )}
            </>
          }
        />

        <LinkTabs
          current={pathname}
          links={[
            {
              label: 'Overview',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id
              )
            },
            {
              label: 'Users',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id,
                'users'
              )
            },
            {
              label: 'Groups',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id,
                'groups'
              )
            },
            {
              label: 'Server Requests',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id,
                'server-requests'
              )
            },
            {
              label: 'Settings',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id,
                'settings'
              )
            }
          ]}
        />

        {portal.data.status != 'active' && (
          <>
            <Spacer size={15} />
            <Callout color="orange">This portal is inactive.</Callout>
          </>
        )}

        <Outlet />
      </ContentLayout>
    )
  );
};
