import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { MagicSessionsTable } from '../../../scenes/magicMcp/sessionsTable';

export let MagicMcpSessionsPage = () => {
  let instance = useCurrentInstance();
  return renderWithLoader({ instance })(({ instance }) => <MagicSessionsTable />);
};
