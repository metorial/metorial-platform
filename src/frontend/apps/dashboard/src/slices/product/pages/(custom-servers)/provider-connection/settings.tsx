import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConnection } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ProviderConnectionUpdateForm } from '../../../scenes/providerConnection/updateForm';

export let ProviderConnectionSettingsPage = () => {
  let instance = useCurrentInstance();

  let { providerConnectionId } = useParams();
  let providerConnection = useProviderConnection(instance.data?.id, providerConnectionId);

  return renderWithLoader({ providerConnection })(({ providerConnection }) => (
    <ProviderConnectionUpdateForm providerConnection={providerConnection.data} />
  ));
};
