import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { SessionConnectionsTable } from '../../../scenes/logsTable/sessionConnectionsTable';

export let SessionConnectionsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <SessionConnectionsTable instanceId={instance.data.id} />
  ));
};
