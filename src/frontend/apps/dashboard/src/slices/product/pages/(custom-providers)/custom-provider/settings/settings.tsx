import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CustomProviderUpdateForm } from '../../../../scenes/customProvider/updateForm';

export let CustomProviderSettingsPage = () => {
  let instance = useCurrentInstance();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

  return renderWithLoader({ customProvider })(({ customProvider }) => (
    <CustomProviderUpdateForm customProvider={customProvider.data} />
  ));
};
