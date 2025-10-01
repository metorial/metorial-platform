import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderConnection,
  useServerDeployment
} from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ProviderConnectionUpdateForm } from '../../../scenes/providerConnection/updateForm';

export let ServerDeploymentOauthPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);
  let oauthConnection = useProviderConnection(
    instance.data?.id,
    deployment.data?.oauthConnection?.id
  );

  return renderWithLoader({ deployment, oauthConnection })(
    ({ deployment, oauthConnection }) => (
      <ProviderConnectionUpdateForm providerConnection={oauthConnection.data} hideDelete />
    )
  );
};
