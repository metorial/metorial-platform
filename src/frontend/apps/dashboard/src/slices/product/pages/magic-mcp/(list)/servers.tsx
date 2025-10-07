import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { MagicMcpServersGrid } from '../../../scenes/magicMcp/serversGrid';

export let MagicMcpServerPage = () => {
  let instance = useCurrentInstance();
  return renderWithLoader({ instance })(({ instance }) => <MagicMcpServersGrid />);
};
