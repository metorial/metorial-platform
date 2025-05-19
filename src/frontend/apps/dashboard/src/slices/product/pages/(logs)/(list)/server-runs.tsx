import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ServerRunsTable } from '../../../scenes/server-runs/table';

export let ServerRunsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => <ServerRunsTable />);
};
