import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { MagicGroupsTable } from '../../../scenes/magicMcp/groupsTable';

export let MagicMcpGroupsPage = () => {
  let instance = useCurrentInstance();
  return renderWithLoader({ instance })(({ instance }) => <MagicGroupsTable />);
};
