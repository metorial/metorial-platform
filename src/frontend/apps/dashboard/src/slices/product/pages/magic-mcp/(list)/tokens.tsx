import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { MagicTokensTable } from '../../../scenes/magicMcp/tokensTable';

export let MagicMcpTokensPage = () => {
  let instance = useCurrentInstance();
  return renderWithLoader({ instance })(({ instance }) => <MagicTokensTable />);
};
