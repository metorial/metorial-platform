'use client';

import { Cases } from '@metorial/case';
import { Button, Entity, Text, Title } from '@metorial/ui';
import styled from 'styled-components';
import { ServerCapabilities, ServerListing } from '../../../../../../state/server';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

let Item = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

export let Tools = ({
  server,
  capabilities
}: {
  server: ServerListing;
  capabilities: ServerCapabilities;
}) => {
  let tools = capabilities.tools ?? [];
  let prompts = capabilities.prompts ?? [];
  let resourceTemplates = capabilities.resourceTemplates ?? [];

  let openExplorer = () => {
    let url = `${process.env.DASHBOARD_FRONTEND_URL}/welcome/jumpstart?path=${encodeURIComponent(`/explorer?server_id=${server.serverId}`)}`;
    window.open(url, '_blank');
  };

  return (
    <Wrapper>
      {!!tools.length && (
        <Item>
          <Title as="h2" size="4" weight="strong">
            Tools
          </Title>

          <Group>
            {tools.length === 0 && <Text>This server has no tools available.</Text>}

            {tools.map((tool, i) => (
              <Entity.Wrapper key={i}>
                <Entity.Content>
                  <Entity.Field
                    title={Cases.toTitleCase(tool.name)}
                    description={tool.description}
                  />
                </Entity.Content>

                <Entity.Footer>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      flexGrow: 1
                    }}
                  >
                    <Button size="1" variant="outline" onClick={() => openExplorer()}>
                      Open in Explorer
                    </Button>

                    <Text size="1" color="gray600">
                      {tool.name}
                    </Text>
                  </div>
                </Entity.Footer>
              </Entity.Wrapper>
            ))}
          </Group>
        </Item>
      )}

      {!!resourceTemplates.length && (
        <Item>
          <Title as="h2" size="4" weight="strong">
            Resource Templates
          </Title>

          <Group>
            {resourceTemplates.length === 0 && (
              <Text>This server has no resource templates available.</Text>
            )}

            {resourceTemplates.map((template, i) => (
              <Entity.Wrapper key={i}>
                <Entity.Content>
                  <Entity.Field
                    title={Cases.toTitleCase(template.name)}
                    description={template.description}
                  />
                </Entity.Content>

                <Entity.Footer>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      flexGrow: 1
                    }}
                  >
                    <Button size="1" variant="outline" onClick={() => openExplorer()}>
                      Open in Explorer
                    </Button>

                    <Text size="1" color="gray600">
                      {template.name}
                    </Text>
                  </div>
                </Entity.Footer>
              </Entity.Wrapper>
            ))}
          </Group>
        </Item>
      )}

      {!!prompts.length && (
        <Item>
          <Title as="h2" size="4" weight="strong">
            Prompts
          </Title>

          <Group>
            {prompts.length === 0 && <Text>This server has no prompts available.</Text>}

            {prompts.map((prompt, i) => (
              <Entity.Wrapper key={i}>
                <Entity.Content>
                  <Entity.Field
                    title={Cases.toTitleCase(prompt.name)}
                    description={prompt.description}
                  />
                </Entity.Content>

                <Entity.Footer>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      flexGrow: 1
                    }}
                  >
                    <Button size="1" variant="outline" onClick={() => openExplorer()}>
                      Open in Explorer
                    </Button>

                    <Text size="1" color="gray600">
                      {prompt.name}
                    </Text>
                  </div>
                </Entity.Footer>
              </Entity.Wrapper>
            ))}
          </Group>
        </Item>
      )}
    </Wrapper>
  );
};
