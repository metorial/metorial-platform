import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { MonitorsTable } from '../../../scenes/monitoring/monitorsTable';

export let MonitorsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({}) => <MonitorsTable />);
};
