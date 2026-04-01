import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags,
  usePortal
} from '@metorial/state';
import { Badge, Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { canShowPortalAuthNavigation } from './shared';

export let PortalLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let { portalId } = useParams();
  let portal = usePortal(instance.data?.id, portalId);
  let pathname = useLocation().pathname;
  let showAuthTab = canShowPortalAuthNavigation(flags.data?.flags);

  return renderWithLoader({ instance, organization, project, portal, flags })(
    ({ instance, organization, project, portal }) => (
      <ContentLayout>
        <PageHeader
          title={portal.data.name}
          description={portal.data.description ?? 'No description'}
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
            portal.data.urls[0]?.url ? (
              <Button
                onClick={() => {
                  window.open(portal.data.urls[0]?.url, '_blank', 'noopener,noreferrer');
                }}
              >
                Open Portal
              </Button>
            ) : undefined
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
              label: 'Consumer Groups',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id,
                'consumer-groups'
              )
            },
            {
              label: 'Consumer Access',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id,
                'consumer-access'
              )
            },
            {
              label: 'Access Requests',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id,
                'access-requests'
              )
            },
            {
              label: 'Consumer Profiles',
              to: Paths.instance.portal(
                organization.data,
                project.data,
                instance.data,
                portal.data.id,
                'consumer-profiles'
              )
            },
            ...(showAuthTab
              ? [
                  {
                    label: 'Auth',
                    to: Paths.instance.portal(
                      organization.data,
                      project.data,
                      instance.data,
                      portal.data.id,
                      'auth'
                    )
                  }
                ]
              : [])
          ]}
        />

        <Outlet />
      </ContentLayout>
    )
  );
};
