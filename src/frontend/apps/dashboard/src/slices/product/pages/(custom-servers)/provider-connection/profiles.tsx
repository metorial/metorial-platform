import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderConnection } from '@metorial/state';
import { Panel } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { ProviderConnectionProfile } from '../../../scenes/providerConnection/profile';
import { ProviderConnectionProfilesTable } from '../../../scenes/providerConnection/profiles';
import { RouterPanel } from '../../../scenes/routerPanel';

export let ProviderConnectionProfilesPage = () => {
  let instance = useCurrentInstance();

  let { providerConnectionId } = useParams();
  let providerConnection = useProviderConnection(instance.data?.id, providerConnectionId);

  return renderWithLoader({ providerConnection })(({ providerConnection }) => (
    <>
      <ProviderConnectionProfilesTable providerConnection={providerConnection.data} />

      <RouterPanel param="profile_id">
        {profileId => (
          <>
            <Panel.Header>
              <Panel.Title>Authentication Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <ProviderConnectionProfile
                providerConnection={providerConnection.data}
                profileId={profileId}
              />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  ));
};
