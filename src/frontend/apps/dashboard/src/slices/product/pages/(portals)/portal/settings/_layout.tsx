import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { SimpleSidebarLayout } from '@metorial/layout';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let PortalSettingsLayout = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.instanceId, params.portalId!);

  let base = [
    instance.data?.organization,
    instance.data?.project,
    instance.data,
    portal.data?.id,
    'settings'
  ] as const;

  return renderWithLoader({ portal })(({ portal }) => (
    <>
      <SimpleSidebarLayout
        groups={[
          {
            items: [
              {
                title: 'Settings',
                to: Paths.instance.portal(...base)
              },
              {
                title: 'Authentication',
                to: Paths.instance.portal(...base, 'authentication')
              },
              {
                title: 'Featured Servers',
                to: Paths.instance.portal(...base, 'featured-servers')
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
