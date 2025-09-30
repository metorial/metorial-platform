import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConnection } from '@metorial/state';
import { Panel } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { ProviderConnectionAuthentication } from '../../../scenes/providerConnection/authentication';
import { ProviderConnectionAuthenticationsTable } from '../../../scenes/providerConnection/authentications';
import { RouterPanel } from '../../../scenes/routerPanel';

export let ProviderConnectionLogsPage = () => {
  let instance = useCurrentInstance();

  let { providerConnectionId } = useParams();
  let providerConnection = useProviderConnection(instance.data?.id, providerConnectionId);

  return renderWithLoader({ providerConnection })(({ providerConnection }) => (
    <>
      <ProviderConnectionAuthenticationsTable providerConnection={providerConnection.data} />

      <RouterPanel param="authentication_id">
        {authenticationId => (
          <>
            <Panel.Header>
              <Panel.Title>Authentication Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <ProviderConnectionAuthentication
                providerConnection={providerConnection.data}
                authenticationId={authenticationId}
              />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  ));
};
