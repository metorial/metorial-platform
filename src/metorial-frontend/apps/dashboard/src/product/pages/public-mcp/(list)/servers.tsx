import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { PublicMcpServersGrid } from '../../../scenes/publicMcp/serversGrid';

export let PublicMcpServersPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <PublicMcpServersGrid instanceId={instance.data.id} />
  ));
};
