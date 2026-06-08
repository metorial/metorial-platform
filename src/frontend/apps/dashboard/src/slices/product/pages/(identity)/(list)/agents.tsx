import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { AgentsTable } from '../../../scenes/identity/agentsTable';

export let AgentsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <AgentsTable instanceId={instance.data.id} />
  ));
};
