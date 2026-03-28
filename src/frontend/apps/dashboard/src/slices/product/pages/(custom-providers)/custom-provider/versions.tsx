import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { Panel } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { CustomProviderVersion } from '../../../scenes/customProvider/version';
import { CustomProviderVersionsTable } from '../../../scenes/customProvider/versions';
import { RouterPanel } from '../../../scenes/routerPanel';

export let CustomProviderVersionsPage = () => {
  let instance = useCurrentInstance();

  let { customProviderId } = useParams();
  let customProvider = useCustomProvider(instance.data?.id, customProviderId);

  return renderWithLoader({ customProvider })(({ customProvider }) => (
    <>
      <CustomProviderVersionsTable customProvider={customProvider.data} />

      <RouterPanel param="version_id" width={1000}>
        {versionId => (
          <>
            <Panel.Header>
              <Panel.Title>Version Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <CustomProviderVersion
                versionId={versionId}
                customProvider={customProvider.data}
              />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  ));
};
