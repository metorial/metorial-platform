import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { SimpleSidebarLayout } from '@metorial/layout';
import { useCurrentInstance, usePortalConsumerGroup } from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let PortalGroupLayout = () => {
  let instance = useCurrentInstance();
  let { portalId, groupId } = useParams();
  let group = usePortalConsumerGroup(instance.data?.id, portalId, groupId);

  if (!portalId || !groupId) return null;

  return renderWithLoader({ group })(({ group }) => (
    <SimpleSidebarLayout
      groups={[
        {
          title: group.data.name,
          items: [
            {
              title: 'Access',
              to: Paths.instance.portal(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                portalId,
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
                portalId,
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
  ));
};
