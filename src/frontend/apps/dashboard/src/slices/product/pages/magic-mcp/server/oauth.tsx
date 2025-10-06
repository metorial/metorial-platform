import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useMagicMcpServer,
  useProviderConnection,
  useServerDeployment
} from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ProviderConnectionUpdateForm } from '../../../scenes/providerConnection/updateForm';

export let MagicMcpServerOauthPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let magicMcpServer = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let deployment = useServerDeployment(
    instance.data?.id,
    magicMcpServer.data?.serverDeployments[0]?.id
  );
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
