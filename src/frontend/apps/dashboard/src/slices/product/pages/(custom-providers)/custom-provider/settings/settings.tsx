import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CustomServerUpdateForm } from '../../../../scenes/customProvider/updateForm';

export let CustomProviderSettingsPage = () => {
  let instance = useCurrentInstance();

  let { customProviderId } = useParams();
  let customServer = useCustomProvider(instance.data?.id, customProviderId);

  return renderWithLoader({ customServer })(({ customServer }) => (
    <CustomServerUpdateForm customServer={customServer.data} />
  ));
};
