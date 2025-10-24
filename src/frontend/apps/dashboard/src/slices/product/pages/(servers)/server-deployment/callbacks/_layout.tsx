import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { SimpleSidebarLayout } from '@metorial/layout';
import {
  useCallback,
  useCurrentInstance,
  useDashboardFlags,
  useServerDeployment
} from '@metorial/state';
import { Outlet, useParams } from 'react-router-dom';
import { Upgrade } from '../../../../../../components/emptyState';

export let ServerDeploymentCallbackLayout = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  let callback = useCallback(instance.data?.id, deployment.data?.callback?.id);

  let flags = useDashboardFlags();

  let serverPathParams = [
    instance.data?.organization,
    instance.data?.project,
    instance.data,
    deployment.data?.id ?? serverDeploymentId
  ] as const;

  if (!flags.data?.flags['paid-callbacks']) {
    return (
      <Upgrade
        title="Metorial Callbacks"
        description="Callbacks let your MCP servers call your application about interesting events, like new messages or status changes."
      />
    );
  }

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
