import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomServer } from '@metorial/state';
import { Panel, Text } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { CustomServerVersion } from '../../../scenes/customServer/version';
import { CustomServerVersionsTable } from '../../../scenes/customServer/versions';
import { RouterPanel } from '../../../scenes/routerPanel';

export let CustomServerVersionsPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  return renderWithLoader({ customServer })(({ customServer }) => {
    let versionManagementUnavailable =
      Boolean(customServer.data?.draft?.remoteMcpServer) ||
      Boolean(customServer.data?.draft?.containerImage);

    if (versionManagementUnavailable) {
      return (
        <SideBox
          title="Version Management Unavailable"
          description="Remote and Docker-backed providers do not publish managed provider versions in Metorial."
        >
          <Text size="2" color="gray600">
            Manage releases outside Metorial for this provider type.
          </Text>
        </SideBox>
      );
    }

    return (
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
    );
  });
};
