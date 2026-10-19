import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { PublicMcpServersTable } from '../../../scenes/publicMcp/serversTable';

export let PublicMcpServersPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <PublicMcpServersTable instanceId={instance.data.id} />
  ));
};
