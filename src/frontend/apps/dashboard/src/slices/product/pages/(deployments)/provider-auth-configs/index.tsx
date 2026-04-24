import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfig
} from '@metorial/state';
import { Attributes, Badge, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { ProviderAuthEventsTable } from '../../../scenes/providerAuthEvents/table';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';
import { UsageScene } from '../../../scenes/usage/usage';
import { formatAuthConfigSource, formatAuthConfigType } from './helpers';

let VariantIcon = styled.div`
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: ${theme.colors.gray300};
  font-size: 12px;
  font-weight: 700;
`;

export let ProviderAuthConfigOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerAuthConfigId } = useParams();
  let authConfig = useProviderAuthConfig(instance.data?.id, providerAuthConfigId);

  return renderWithLoader({ authConfig })(({ authConfig }) => {
    let authMethodName =
      authConfig.data.authMethod?.name ?? authConfig.data.authMethod?.key ?? 'Unknown method';
    let deploymentTargetId = authConfig.data.deployment?.id;
    let deploymentTargetName = authConfig.data.deployment?.name ?? deploymentTargetId;

    return (
      <>
        <Attributes
          itemWidth="300px"
          attributes={[
            {
              label: 'Type',
              content: formatAuthConfigType(authConfig.data.type)
            },
            {
              label: 'Source',
              content: formatAuthConfigSource(authConfig.data.source)
            },
            {
              label: 'Status',
              content: (
                <Badge color={authConfig.data.status === 'active' ? 'green' : 'gray'}>
                  {authConfig.data.status}
                </Badge>
              )
            },
            {
              label: 'Deployment',
              content: deploymentTargetId ? (
                <Link
                  to={Paths.instance.providerDeployment(
                    organization.data,
                    project.data,
                    instance.data,
                    deploymentTargetId
                  )}
                >
                  {deploymentTargetName}
                </Link>
              ) : (
                <Text size="2" color="gray600">
                  N/A
                </Text>
              )
            },
            {
              label: 'Auth Method',
              content: authMethodName
            },
            {
              label: 'Updated At',
              content: <RenderDate date={authConfig.data.updatedAt} />
            }
          ]}
        />

        <Spacer height={15} />

        <UsageScene
          title="Usage"
          description="See how this auth config is being used in your instance."
          entities={[{ type: 'provider_auth_config', id: authConfig.data.id }]}
          entityNames={{
            [authConfig.data.id]: authConfig.data.name ?? authConfig.data.id
          }}
        />

        <Spacer height={15} />

        <Box
          title="Auth Events"
          description="Recent authentication lifecycle events captured for this auth config."
        >
          <ProviderAuthEventsTable
            providerAuthConfigId={authConfig.data.id}
            emptyText="No auth events have been captured for this auth config yet."
          />
        </Box>

        <Spacer height={15} />

        <Box
          title="Recent Sessions"
          description="Latest sessions currently using this authentication configuration."
        >
          <ProviderSessionsTable providerAuthConfigId={authConfig.data.id} />
        </Box>

        {authConfig.data.metadata && Object.keys(authConfig.data.metadata).length > 0 ? (
          <>
            <Spacer height={15} />

            <Box
              title="Metadata"
              description="Additional metadata stored on this authentication configuration."
            >
              <CodeBlock
                code={JSON.stringify(authConfig.data.metadata, null, 2)}
                lineNumbers={false}
              />
            </Box>
          </>
        ) : null}
      </>
    );
  });
};
