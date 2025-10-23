import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { SimpleSidebarLayout } from '@metorial/layout';
import { useCallback, useCurrentInstance, useServerDeployment } from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';

export let CallbackLayout = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  let callback = useCallback(instance.data?.id, deployment.data?.callback?.id);

  let serverPathParams = [
    instance.data?.organization,
    instance.data?.project,
    instance.data,
    deployment.data?.id ?? serverDeploymentId
  ] as const;

  return renderWithLoader({ callback })(({ callback }) => (
    <SimpleSidebarLayout
      groups={[
        {
          icon: '',
          items: [
            {
              title: 'Overview',
              to: Paths.instance.serverDeployment(...serverPathParams, 'callbacks')
            },
            {
              title: 'Events',
              to: Paths.instance.serverDeployment(...serverPathParams, 'callbacks', 'events')
            },
            {
              title: 'Logs',
              to: Paths.instance.serverDeployment(...serverPathParams, 'callbacks', 'logs')
            },
            {
              title: 'Destinations',
              to: Paths.instance.serverDeployment(
                ...serverPathParams,
                'callbacks',
                'destinations'
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
