import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomServer } from '@metorial/state';
import { Panel } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { CustomServerVersion } from '../../../scenes/customServer/version';
import { CustomServerVersionsTable } from '../../../scenes/customServer/versions';
import { RouterPanel } from '../../../scenes/routerPanel';

export let CustomServerVersionsPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  return renderWithLoader({ customServer })(({ customServer }) => (
    <>
      <CustomServerVersionsTable customServer={customServer.data} />

      <RouterPanel param="version_id" width={1000}>
        {versionId => (
          <>
            <Panel.Header>
              <Panel.Title>Version Details</Panel.Title>
            </Panel.Header>

            <Panel.Content>
              <CustomServerVersion versionId={versionId} customServer={customServer.data} />
            </Panel.Content>
          </>
        )}
      </RouterPanel>
    </>
  ));
};
