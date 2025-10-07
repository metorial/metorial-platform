import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { useBoot, useMagicMcpServers, useMagicMcpTokens } from '@metorial/state';
import { Button, InfoTooltip, Select, Spacer, theme, useCopy } from '@metorial/ui';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { ServerListing } from '../../../../../../state/server';
import { ConnectionType, connectionTypes } from './connection';

let Wrapper = styled.div`
  border: ${theme.colors.gray400} solid 1px;
  border-radius: 8px;
  margin-bottom: 35px;
`;

let Header = styled.header`
  display: flex;
  gap: 5px;
  align-items: center;
  color: ${theme.colors.gray800};
  padding: 10px 15px;

  h1 {
    font-size: 14px;
    font-weight: 600;
  }
`;

let Content = styled.main`
  padding: 15px;
  border-top: ${theme.colors.gray400} solid 1px;
`;

let List = styled.ol`
  margin: 0;
  padding-left: 20px;
  list-style: decimal;
  font-size: 14px;
  font-weight: 500;
  color: ${theme.colors.gray700};

  li {
    margin-bottom: 10px;
  }
`;

export let Deploy = ({ server }: { server: ServerListing }) => {
  let boot = useBoot();
  let [selectedInstanceId, setSelectedInstanceId] = useState<string>();

  let orgsWithInstances = useMemo(
    () =>
      boot.data?.organizations.map(o => {
        let instances = boot.data!.instances.filter(i => i.organizationId == o.id);
        return {
          ...o,
          instances
        };
      }),
    [boot.data]
  );

  let instance = useMemo(
    () => boot.data?.instances.find(i => i.id == selectedInstanceId),
    [selectedInstanceId, boot.data]
  );

  useEffect(() => {
    if (!orgsWithInstances) return;

    let org = orgsWithInstances.find(o => o.instances.length);
    if (!org) return;

    let devInstance = org.instances.find(i => i.type == 'development');
    if (!devInstance) devInstance = org.instances[0];
    if (devInstance) setSelectedInstanceId(devInstance.id);
  }, [orgsWithInstances]);

  let deployments = useMagicMcpServers(selectedInstanceId, {
    status: 'active',
    serverId: server.serverId
  });

  let tokens = useMagicMcpTokens(selectedInstanceId, {
    status: 'active'
  });

  let [tab, setTab] = useState<ConnectionType>('cursor');
  let con = connectionTypes[tab];

  let copy = useCopy();

  let doDeploy = () => {
    let url = `${process.env.DASHBOARD_FRONTEND_URL}/welcome/jumpstart?path=${encodeURIComponent(`/deploy?server_id=${server.serverId}&next_url=${encodeURIComponent(window.location.href)}`)}`;
    location.replace(url);
  };

  if (!server.isHostable) return;

  return (
    <Wrapper>
      <Header>
        <h1>Connect to {server.name} on Metorial</h1>
        <InfoTooltip>Connect to this server via Metorial Magic MCP.</InfoTooltip>
      </Header>

      {!!boot.data?.organizations.length ? (
        <>
          <Content>
            <Select
              label="Organization"
              items={
                orgsWithInstances
                  ?.filter(o => o.instances.length)
                  .map(o => ({
                    id: o.id,
                    label: o.name
                  })) ?? []
              }
              onChange={orgId => {
                let org = orgsWithInstances?.find(o => o.id == orgId);
                if (!org) return;
                let devInstance = org.instances.find(i => i.type == 'development');
                if (!devInstance) devInstance = org.instances[0];
                if (devInstance) setSelectedInstanceId(devInstance.id);
              }}
              value={instance?.organizationId}
            />
          </Content>

          {renderWithLoader({ deployments, tokens })(({ deployments, tokens }) => {
            let deployment = deployments.data.items[0];
            if (!deployment) {
              return (
                <Content>
                  <Button onClick={doDeploy}>Deploy {server.name} on Metorial</Button>
                </Content>
              );
            }

            let token = tokens.data.items[0];
            let ui = con.getConnection(server, deployment, token);

            return (
              <>
                <Content>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      flexDirection: 'column'
                    }}
                  >
                    <a
                      href={`https://app.metorial.com/i/${instance?.organization.slug}/${instance?.project.slug}/${instance?.slug}/magic-mcp/server/${deployment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ width: '100%' }}
                    >
                      <Button size="2" fullWidth variant="outline">
                        Metorial Dashboard
                      </Button>
                    </a>

                    <a
                      href={`https://app.metorial.com/i/${instance?.organization.slug}/${instance?.project.slug}/${instance?.slug}/explorer?server_deployment_id=${deployment.serverDeployments[0].id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ width: '100%' }}
                    >
                      <Button size="2" fullWidth>
                        Metorial Explorer
                      </Button>
                    </a>
                  </div>
                </Content>

                <Content>
                  <Select
                    label="Client"
                    description="Select which MCP client you want to use."
                    items={Object.entries(connectionTypes).map(([key, value]) => ({
                      id: key,
                      label: value.name
                    }))}
                    value={tab}
                    onChange={v => setTab(v as ConnectionType)}
                  />

                  <Spacer height={15} />

                  <List>
                    {ui.steps.map((step, i) => (
                      <li key={i}>
                        <p>{step.text}</p>

                        {'command' in step && step.command && (
                          <>
                            <CodeBlock code={step.command} lineNumbers={false} />
                            <Spacer height={5} />
                            <Button
                              variant="outline"
                              size="1"
                              onClick={() => copy.copy(step.command!)}
                              success={copy.copied}
                            >
                              Copy command
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </List>

                  {'config' in ui && ui.config && (
                    <>
                      <CodeBlock
                        language="json"
                        code={JSON.stringify(ui.config, null, 2)}
                        lineNumbers={false}
                      />
                      <Spacer height={5} />
                      <Button
                        variant="outline"
                        size="1"
                        onClick={() => copy.copy(JSON.stringify(ui.config, null, 2))}
                        success={copy.copied}
                      >
                        Copy configuration
                      </Button>
                    </>
                  )}
                </Content>
              </>
            );
          })}
        </>
      ) : (
        <Content>
          <Button onClick={doDeploy}>Deploy {server.name} on Metorial</Button>
        </Content>
      )}
    </Wrapper>
  );
};
