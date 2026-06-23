import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { ProviderAuthEventsTable } from '../../../scenes/providerAuthEvents/table';

export let ProviderAuthEventsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance: _instance }) => (
    <ProviderAuthEventsTable linkToDetail limit={25} />
  ));
};
