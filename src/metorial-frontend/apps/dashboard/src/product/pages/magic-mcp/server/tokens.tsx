import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { MagicTokensTable } from '../../../scenes/magicMcp/tokensTable';

export let MagicMcpServerTokensPage = () => {
  let instance = useCurrentInstance();
  let { magicMcpServerId } = useParams();

  return renderWithLoader({ instance })(({}) => (
    <MagicTokensTable magicMcpServerId={magicMcpServerId} />
  ));
};
