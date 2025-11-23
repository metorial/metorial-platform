import { ServersGetOutput } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { Button, Entity, Panel, showModal } from '@metorial/ui';
import styled from 'styled-components';
import { useCreateMagicMcpServer } from '../../state/consumer/magicMcpServer';
import { useServerDeploymentTemplates } from '../../state/consumer/serverDeploymentTemplates';
import { useServer } from '../../state/consumer/servers';

let Wrapper = styled.div``;

export let DeployServerButton = ({ serverId }: { serverId: string }) => {
  let server = useServer(serverId);

  // let magicMcpServers = useMagicMcpServers()
  let templates = useServerDeploymentTemplates({
    serverId: server.data?.id
  });

  let createServer = useCreateMagicMcpServer();

  return (
    <Button
      size="2"
      onClick={() =>
        showModal(({ dialogProps }) => {
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
                    <Entity.Wrapper key={template.id}>
                      <Entity.Content>
                        <Entity.Field
                          title={template.name}
                          description={template.description}
                        />

                        <Entity.Field title="Actions" right>
                          <Button
                            size="2"
                            onClick={() => deployServer({ server: server.data! })}
                          >
                            Use Template
                          </Button>
                        </Entity.Field>
                      </Entity.Content>
                    </Entity.Wrapper>
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

export let deployServer = async ({ server }: { server: ServersGetOutput }) => {};
