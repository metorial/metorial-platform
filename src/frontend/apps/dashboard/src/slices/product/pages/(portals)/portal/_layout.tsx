import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePortal
} from '@metorial/state';
import { Button, Callout, LinkTabs, Spacer } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { showConsumerGroupFormModal } from '../../../scenes/portals/groupsTable';

export let PortalLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);

  let pathname = useLocation().pathname;
  if (pathname.includes('/group/')) pathname = pathname.split('/group/')[0] + '/groups';

  let pathParams = [
    organization.data,
    project.data,
    instance.data,
    portal.data?.id ?? params.portalId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={portal.data?.name ?? '...'}
        description={portal.data?.description}
        pagination={[
          {
            label: 'Portals',
            href: Paths.instance.portals(organization.data, project.data, instance.data)
          },
          {
            label: portal.data?.name,
            href: Paths.instance.portal(...pathParams)
          }
        ]}
        actions={
          <>
            {pathname.endsWith('/groups') && (
              <Button
                onClick={() => showConsumerGroupFormModal({ portalId: portal.data?.id! })}
                size="2"
              >
                Create Group
              </Button>
            )}
          </>
        }
      />

      {renderWithLoader({ portal })(({ portal }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.portal(...pathParams)
              },

              {
                label: 'Users',
                to: Paths.instance.portal(...pathParams, 'users')
              },
              {
                label: 'Groups',
                to: Paths.instance.portal(...pathParams, 'groups')
              },

              {
                label: 'Settings',
                to: Paths.instance.portal(...pathParams, 'settings')
              }
            ]}
          />

          {portal.data?.status == 'inactive' && (
            <>
              <Callout color="orange">This portal has been deleted.</Callout>

              <Spacer height={15} />
            </>
          )}

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
