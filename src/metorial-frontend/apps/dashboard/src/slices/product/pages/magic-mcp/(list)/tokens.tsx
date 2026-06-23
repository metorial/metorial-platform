import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { MagicTokensTable } from '../../../scenes/magicMcp/tokensTable';

export let MagicMcpTokensPage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();

  return renderWithLoader({ instance })(({ instance }) => (
    <MagicTokensTable magicMcpServerId={magicMcpServerId} />
  ));
};
