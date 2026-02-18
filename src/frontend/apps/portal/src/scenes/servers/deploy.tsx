import {
  DashboardInstanceMagicMcpServersCreateOutput,
  ServersGetOutput
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { ServersDeploymentsTemplatesGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { useForm } from '@metorial/data-hooks';
import { Button, Dialog, Entity, Input, Panel, showModal, Spacer } from '@metorial/ui';
import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  createMagicMcpServer,
  updateMagicMcpServer
} from '../../state/consumer/magicMcpServer';
import { authenticateWithOauth } from '../../state/consumer/oauthSession';
import { useServerDeploymentTemplates } from '../../state/consumer/serverDeploymentTemplates';
import {
  useCreateServerRequest,
  useServerRequests
} from '../../state/consumer/serverRequests';
import { useServer } from '../../state/consumer/servers';
import { usePaths } from '../../state/portal/path';
import { JsonSchemaInput } from '../jsonSchemaInput';

let Wrapper = styled.div``;

export let DeployServerButton = ({ serverId }: { serverId: string }) => {
  let server = useServer(serverId);

  let templates = useServerDeploymentTemplates({
    serverId: server.data?.id
  });
  let createServer = useServerRequests({
    serverId
  });
  let hasPendingRequest = createServer.data?.items.some(req => req.status === 'pending');

  let Paths = usePaths();

  let navigate = useNavigate();

  if (templates.data?.items.length === 0) {
    return (
      <Button
        size="2"
        disabled={createServer.isLoading || hasPendingRequest}
        onClick={() =>
          showModal(({ dialogProps, close }) => {
            let createServer = useCreateServerRequest();

            let form = useForm({
              initialValues: {
                reason: ''
              },
              onSubmit: async values => {
                let [res] = await createServer.mutate({
                  serverId,
                  reason: values.reason
                });
                if (res) setTimeout(() => close(), 500);
              },
              schema: yup =>
                yup.object({
                  reason: yup.string().required('Reason is required')
                })
            });

            return (
              <Dialog.Wrapper {...dialogProps}>
                <Dialog.Title>Request Access to {server.data?.name}</Dialog.Title>
                <Dialog.Description>
                  You do not have access to deploy this MCP server. Please request access from
                  your organization administrator.
                </Dialog.Description>

                <form onSubmit={form.handleSubmit}>
                  <Input
                    label="Reason for Access"
                    as="textarea"
                    minRows={4}
                    {...form.getFieldProps('reason')}
                  />
                  <form.RenderError field="reason" />

                  <Spacer height={15} />

                  <Dialog.Actions>
                    <Button size="2" variant="outline" onClick={close}>
                      Cancel
                    </Button>

                    <Button
                      size="2"
                      type="submit"
                      loading={createServer.isLoading}
                      success={createServer.isSuccess}
                    >
                      Submit Request
                    </Button>
                  </Dialog.Actions>
                  <createServer.RenderError />
                </form>
              </Dialog.Wrapper>
            );
          })
        }
      >
        Request Access
      </Button>
    );
  }

  return (
    <Button
      size="2"
      disabled={templates.isLoading}
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
                                    location.replace(Paths.magicMcpServer(magicMcpServer.id));
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
  let currentVersion = server.variants?.[0]?.currentVersion;
  if (!currentVersion) return;

  let serverNeedsConfig =
    currentVersion?.schema &&
    Object.entries(currentVersion?.schema?.properties ?? {}).length > 0;

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
            schema={currentVersion?.schema ?? {}}
            value={config}
            onChange={v => setConfig(v)}
            variant="raw"
          />

          <Spacer height={15} />

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
