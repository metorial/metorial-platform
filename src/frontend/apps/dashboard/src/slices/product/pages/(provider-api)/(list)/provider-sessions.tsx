import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Spacer } from '@metorial/ui';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';

export let ProviderSessionsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Spacer size={15} />

      <ProviderSessionsTable instanceId={instance.data.id} />
    </>
  ));
};
