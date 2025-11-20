import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { SimpleSidebarLayout } from '@metorial/layout';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let PortalSettingsLayout = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);

  return renderWithLoader({ portal })(({ portal }) => (
    <>
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
                  portal.data?.id,
                  'settings'
                )
              },
              {
                title: 'Authentication',
                to: Paths.instance.portal(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  portal.data?.id,
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
    </>
  ));
};
