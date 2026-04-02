import { Paths } from '@metorial/frontend-config';
import { SimpleSidebarLayout } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let PortalSettingsLayout = () => {
  let instance = useCurrentInstance();
  let { portalId } = useParams();

  if (!portalId) return null;

  return (
    <SimpleSidebarLayout
      groups={[
        {
          items: [
            {
              title: 'Settings',
              to: Paths.instance.portal(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                portalId,
                'settings'
              )
            },
            {
              title: 'Authentication',
              to: Paths.instance.portal(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                portalId,
                'settings',
                'authentication'
              )
            }
          ]
        }
      ]}
    >
      <Outlet />
    </SimpleSidebarLayout>
  );
};
