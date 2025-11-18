import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { SimpleSidebarLayout } from '@metorial/layout';
import { useCurrentInstance, usePortal, usePortalConsumerGroup } from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let PortalGroupLayout = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);
  let group = usePortalConsumerGroup(instance.data?.id, portal.data?.id, params.groupId);

  return renderWithLoader({ group })(({ group }) => (
    <>
      <SimpleSidebarLayout
        groups={[
          {
            title: group.data.name,
            items: [
              {
                title: 'MCP Servers',
                to: Paths.instance.portal(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  portal.data?.id,
                  'group',
                  group.data.id
                )
              },
              {
                title: 'Settings',
                to: Paths.instance.portal(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  portal.data?.id,
                  'group',
                  group.data.id,
                  'settings'
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
