import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ServerErrorGroupsTable } from '../../../scenes/serverErrors/groupsTable';

export let ServerErrorsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => <ServerErrorGroupsTable />);
};
