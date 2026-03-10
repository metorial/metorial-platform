import { CodeBlock } from '@metorial/code';
import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProvider,
  useProviderConfig,
  useProviderDeployment,
  useProviderSpecification,
  useSessions
} from '@metorial/state';
import { Badge, Button, Callout, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Box, ID, SideBox, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { SessionConnectionStatusBadge } from '../../../scenes/sessions/table';

let SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: ${theme.colors.gray300};
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  overflow: hidden;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let SummaryItem = styled.div`
  background: ${theme.colors.background};
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
`;

let SummaryValue = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

export let ProviderConfigOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerDeploymentId, providerConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let config = useProviderConfig(instance.data?.id, providerDeploymentId, providerConfigId);
  let provider = useProvider(
    instance.data?.id,
    deployment.data?.providerId ?? config.data?.providerId ?? undefined
  );
  let specification = useProviderSpecification(instance.data?.id, config.data?.specificationId);
  let sessions = useSessions(
    instance.data?.id && config.data?.id ? instance.data.id : null,
    config.data?.id
      ? {
          providerConfigId: config.data.id,
          order: 'desc'
        }
      : undefined
  );
  let sessionsContent = renderWithPagination(sessions)(sessions => (
    <>
      {sessions.data.items.length > 0 ? (
        <Table
          headers={['Status', 'Deployments', 'Name', 'Created']}
          data={sessions.data.items.map(session => ({
            href: Paths.instance.session(
              organization.data,
              project.data,
              instance.data,
              session.id
            ),
            data: [
              <SessionConnectionStatusBadge
                connectionStatus={session.connectionState}
                hasErrors={session.hasErrors}
                hasWarnings={session.hasWarnings}
              />,
              <Text size="2" weight="strong">
                {session.providers
                  ?.map(s => s.deployment?.name ?? s.providerId ?? 'Unknown')
                  .join(', ') || 'No deployments'}
              </Text>,
              <Text size="2">{session.name ?? 'Unnamed Session'}</Text>,
              <RenderDate date={session.createdAt} />
            ]
          }))}
        />
      ) : (
        <Callout color="gray">
          No sessions are using this configuration yet.
        </Callout>
      )}
    </>
  ));

  return renderWithLoader({ config, deployment })(({ config, deployment }) => (
    <>
      <SummaryGrid>
        {[
          {
            label: 'Type',
            content: config.data.isDefault ? (
              <Badge color="blue">Default</Badge>
            ) : (
              <Badge color="gray">Custom</Badge>
            )
          },
          {
            label: 'Source',
            content: config.data.fromVault ? (
              <SummaryValue>
                <Badge color="purple">Vault</Badge>
                <Link
                  to={Paths.instance.providerConfigVault(
                    organization.data,
                    project.data,
                    instance.data,
                    config.data.fromVault.id
                  )}
                >
                  {config.data.fromVault.name ?? config.data.fromVault.id}
                </Link>
              </SummaryValue>
            ) : (
              'Direct'
            )
          },
          {
            label: 'Deployment',
            content: (
              <Link
                to={Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  deployment.data.id
                )}
              >
                {deployment.data.name ?? deployment.data.id}
              </Link>
            )
          },
          {
            label: 'Provider',
            content: provider.data?.name ?? specification.data?.name ?? deployment.data.providerId
          },
          {
            label: 'Config ID',
            content: <ID id={config.data.id} />
          },
          {
            label: 'Updated At',
            content: <RenderDate date={config.data.updatedAt} />
          }
        ].map(item => (
          <SummaryItem key={String(item.label)}>
            <Text weight="bold" size="1">
              {item.label}
            </Text>
            <Text size="1" weight="medium" color="gray700" as="div">
              {item.content}
            </Text>
          </SummaryItem>
        ))}
      </SummaryGrid>

      <Spacer height={20} />

      <SideBox
        title={provider.data?.name ?? specification.data?.name ?? 'Provider'}
        description={
          specification.data?.description ??
          'This config belongs to the selected provider deployment.'
        }
      >

        {config.data.fromVault ? (
          <Link
            to={Paths.instance.providerConfigVault(
              organization.data,
              project.data,
              instance.data,
              config.data.fromVault.id
            )}
          >
            <Button as="span" size="2" variant="outline">
              View Vault
            </Button>
          </Link>
        ) : provider.data ? (
          <Link
            to={Paths.instance.provider(
              organization.data,
              project.data,
              instance.data,
              provider.data.id
            )}
          >
            <Button as="span" size="2" variant="outline">
              View Provider
            </Button>
          </Link>
        ) : (
          <Text size="2" color="gray600">
            Direct values
          </Text>
        )}
      </SideBox>

      <Spacer height={20} />

      <Box
        title="Recent Sessions"
        description="Latest sessions currently using this configuration."
      >
        {sessionsContent}
      </Box>

      {config.data.metadata && Object.keys(config.data.metadata).length > 0 ? (
        <>
          <Spacer height={20} />

          <Box title="Metadata" description="Additional metadata stored on this configuration.">
            <CodeBlock
              code={JSON.stringify(config.data.metadata, null, 2)}
              lineNumbers={false}
            />
          </Box>
        </>
      ) : null}
    </>
  ));
};
