import {
  DashboardInstanceMagicMcpServersCreateOutput,
  ServersGetOutput
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { ServersDeploymentsTemplatesGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { Button, Dialog, Entity, Panel, showModal, Spacer } from '@metorial/ui';
import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  createMagicMcpServer,
  updateMagicMcpServer
} from '../../state/consumer/magicMcpServer';
import { authenticateWithOauth } from '../../state/consumer/oauthSession';
import { useServerDeploymentTemplates } from '../../state/consumer/serverDeploymentTemplates';
import { useServer } from '../../state/consumer/servers';
import { usePaths } from '../../state/portal/path';
import { JsonSchemaInput } from '../jsonSchemaInput';

let Wrapper = styled.div``;

export let DeployServerButton = ({ serverId }: { serverId: string }) => {
  let server = useServer(serverId);

  let templates = useServerDeploymentTemplates({
    serverId: server.data?.id
  });
  let Paths = usePaths();

  let navigate = useNavigate();

  return (
    <Button
      size="2"
      onClick={() =>
        showModal(({ dialogProps, close }) => {
          return (
            <Panel.Wrapper {...dialogProps}>
              <Panel.Header>
                <Panel.Title>Configure {server.data?.name}</Panel.Title>
                <Panel.Description>
                  Your organization has prepared the following templates for this MCP server.
                  Pick one to configure it.
                </Panel.Description>
              </Panel.Header>

              <Panel.Content>
                <Wrapper>
                  {templates.data?.items.map(template => (
                    <Fragment key={template.id}>
                      <Entity.Wrapper>
                        <Entity.Content>
                          <Entity.Field
                            title={template.name}
                            description={template.description}
                          />

                          <Entity.Field title="Actions" right>
                            <Button
                              size="2"
                              onClick={() =>
                                deployServer({
                                  server: server.data!,
                                  template,
                                  onComplete: async magicMcpServer => {
                                    navigate(Paths.magicMcpServer(magicMcpServer.id));
                                    close();
                                  }
                                })
                              }
                            >
                              Use Template
                            </Button>
                          </Entity.Field>
                        </Entity.Content>
                      </Entity.Wrapper>

                      <Spacer height={15} />
                    </Fragment>
                  ))}
                </Wrapper>
              </Panel.Content>
            </Panel.Wrapper>
          );
        })
      }
    >
      Configure Server
    </Button>
  );
};

export let deployServer = async ({
  server,
  template,
  onComplete
}: {
  server: ServersGetOutput;
  template: ServersDeploymentsTemplatesGetOutput;
  onComplete?: (magicMcpServer: DashboardInstanceMagicMcpServersCreateOutput) => void;
}) => {
  let variant = server.variants[0];
  if (!variant) return;

  let serverNeedsConfig =
    variant?.currentVersion?.schema &&
    Object.entries(variant?.currentVersion?.schema?.properties ?? {}).length > 0;

  let doDeployServer = async (config?: any) => {
    let [magicMcpServer] = await createMagicMcpServer({
      serverId: server.id,
      serverDeploymentTemplateId: template.id,
      config: config || {},

      name: server.name
    });
    if (!magicMcpServer) return;

    if (magicMcpServer.oauthConfiguration.status == 'not_configured') {
      let oauthSessionId = await authenticateWithOauth({
        serverDeploymentId: magicMcpServer.serverDeployments[0].id
      });

      await updateMagicMcpServer({
        magicMcpServerId: magicMcpServer.id,
        defaultOauthSessionId: oauthSessionId
      });
    }

    onComplete?.(magicMcpServer);
  };

  if (serverNeedsConfig) {
    showModal(({ dialogProps, close }) => {
      let [config, setConfig] = useState<any>({});
      let [loading, setLoading] = useState(false);

      return (
        <Dialog.Wrapper {...dialogProps}>
          <Dialog.Title>Configure {server.name}</Dialog.Title>
          <Dialog.Description>
            Before you can use this MCP server, you need to configure it first.
          </Dialog.Description>

          <JsonSchemaInput
            label="Config"
            schema={variant?.currentVersion?.schema ?? {}}
            value={config}
            onChange={v => setConfig(v)}
            variant="raw"
          />

          <Dialog.Actions>
            <Button size="2" variant="outline" onClick={close}>
              Cancel
            </Button>

            <Button
              size="2"
              onClick={() => {
                doDeployServer(config);
                setLoading(true);

                setTimeout(() => close(), 1000);
              }}
              loading={loading}
            >
              Deploy Server
            </Button>
          </Dialog.Actions>
        </Dialog.Wrapper>
      );
    });
  } else {
    await doDeployServer();
  }
};
