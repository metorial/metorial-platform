import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ServerDeploymentsTable } from '../../../scenes/server-deployments/table';

export let ServersDeploymentsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <ServerDeploymentsTable />
    </>
  ));
};
