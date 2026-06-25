import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { AlertsTable } from '../../../scenes/monitoring/alertsTable';

export let AlertsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({}) => <AlertsTable />);
};
