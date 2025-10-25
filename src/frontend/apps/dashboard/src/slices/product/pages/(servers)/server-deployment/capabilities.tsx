import { CodeBlock } from '@metorial/code';
import { DashboardInstanceServersVersionsGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useServerCapabilities,
  useServerDeployment,
  useServerVersions
} from '@metorial/state';
import {
  Badge,
  Button,
  Dialog,
  Entity,
  Flex,
  RenderDate,
  showModal,
  Text
} from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

export let ServerDeploymentCapabilitiesPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  let versions = useServerVersions(instance.data?.id, deployment.data?.server.id, {
    order: 'desc'
  });

  return renderWithPagination(versions)(versions => (
    <Wrapper>
      {versions.data.items.map(version => (
        <CapabilityEntry key={version.id} serverVersion={version} />
      ))}
    </Wrapper>
  ));
};

export let CapabilityEntry = (p: {
  serverVersion: DashboardInstanceServersVersionsGetOutput;
}) => {
  let instance = useCurrentInstance();

  let capabilities = useServerCapabilities(instance.data?.id, {
    serverVersionId: p.serverVersion.id
  });

  return (
    <Entity.Wrapper>
      <Entity.Content>
        <Entity.Field title="Version" value={p.serverVersion.identifier} />
        <Entity.Field title="Version ID" value={<ID id={p.serverVersion.id} />} />
        <Entity.Field
          title="Created"
          value={<RenderDate date={p.serverVersion.createdAt} />}
        />
      </Entity.Content>

      <Entity.ContentRaw>
        {renderWithLoader({ capabilities })(({ capabilities }) => (
          <>
            {capabilities.data.tools.length ||
            capabilities.data.resourceTemplates.length ||
            capabilities.data.prompts.length ? (
              <Table
                headers={['Name', 'Type', '']}
                data={[
                  ...capabilities.data.tools.map(t => ({
                    name: t.name,
                    description: t.description,
                    type: (
                      <Badge size="1" color="blue">
                        Tool
                      </Badge>
                    ),
                    details: t
                  })),

                  ...capabilities.data.resourceTemplates.map(i => ({
                    name: i.name,
                    description: i.description,
                    type: (
                      <Badge size="1" color="purple">
                        Resource Template
                      </Badge>
                    ),
                    details: i
                  })),

                  ...capabilities.data.prompts.map(i => ({
                    name: i.name,
                    description: i.description,
                    type: (
                      <Badge size="1" color="yellow">
                        Prompt
                      </Badge>
                    ),
                    details: i
                  }))
                ].map(tool => [
                  <Flex direction="column" gap="4">
                    <Text size="2" weight="medium">
                      {tool.name}
                    </Text>
                    <Text size="1" color="gray600">
                      {tool.description}
                    </Text>
                  </Flex>,
                  tool.type,
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'end'
                    }}
                  >
                    <Button
                      size="1"
                      variant="outline"
                      onClick={() =>
                        showModal(({ dialogProps }) => (
                          <Dialog.Wrapper {...dialogProps} width={600}>
                            <Dialog.Title>{tool.name} Details</Dialog.Title>
                            {tool.description && (
                              <Dialog.Description>{tool.description}</Dialog.Description>
                            )}

                            <CodeBlock
                              language="json"
                              code={JSON.stringify(tool.details, null, 2)}
                            />
                          </Dialog.Wrapper>
                        ))
                      }
                    >
                      View Details
                    </Button>
                  </div>
                ])}
              />
            ) : (
              <Text size="2" color="gray600">
                No capabilities found for this server version.
              </Text>
            )}
          </>
        ))}
      </Entity.ContentRaw>
    </Entity.Wrapper>
  );
};
