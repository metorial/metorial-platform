import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomServer } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CustomServerUpdateForm } from '../../../../scenes/customServer/updateForm';

export let CustomServerSettingsPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  return renderWithLoader({ customServer })(({ customServer }) => (
    <CustomServerUpdateForm customServer={customServer.data} />
  ));
};
