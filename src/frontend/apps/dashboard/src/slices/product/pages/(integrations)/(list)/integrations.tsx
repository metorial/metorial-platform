import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { IntegrationsGrid } from '../../../scenes/integrations/grid';

export let IntegrationsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <IntegrationsGrid instanceId={instance.data.id} />
  ));
};
