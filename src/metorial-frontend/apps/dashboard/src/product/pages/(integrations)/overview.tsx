import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import type { ResourceCountResource } from '@metorial/state';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useLastUsedEnclaves,
  useResourceCounts
} from '@metorial/state';
import { Badge, Button, RenderDate, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { HomeProvidersTable } from '../../scenes/providers/homeTable';

let PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let StatGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
`;

let StatTile = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid ${theme.colors.gray400};
  box-shadow: ${theme.shadows.small};
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: ${theme.colors.gray200};
    border-color: ${theme.colors.gray400};
  }
`;

let ActivityGrid = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
`;

let ChartGrid = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
`;

let ResourceGrid = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

let ResourceList = styled.div`
  display: flex;
  flex-direction: column;
`;

let ResourceLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid ${theme.colors.gray300};
  color: inherit;
  text-decoration: none;

  &:last-child {
    border-bottom: 0;
  }
`;

let ResourceText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let ResourceAction = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

let EnclaveList = styled.div`
  display: flex;
  flex-direction: column;
`;

let EnclaveRow = styled(Link)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid ${theme.colors.gray300};
  color: inherit;
  text-decoration: none;

  &:last-child {
    border-bottom: 0;
  }
`;

type Resource = {
  label: string;
  description: string;
  to: string;
  countResources: ResourceCountResource[];
  action: string;
  tone?: 'green' | 'blue' | 'orange' | 'gray';
};

type Stat = {
  label: string;
  to: string;
  countResources: ResourceCountResource[];
};

let ResourceBox = ({
  title,
  description,
  resources,
  getResourceCount
}: {
  title: string;
  description: string;
  resources: Resource[];
  getResourceCount: (resource: Resource) => number | null;
}) => (
  <Box title={title} description={description}>
    <ResourceList>
      {resources.map(resource => {
        let count = getResourceCount(resource);

        return (
          <ResourceLink key={resource.to} to={resource.to}>
            <ResourceText>
              <ResourceAction>
                <Text size="2" weight="strong">
                  {resource.label}
                </Text>
                <Badge size="1" color={resource.tone ?? 'gray'}>
                  {count === null ? '...' : `${count.toLocaleString()} total`}
                </Badge>
              </ResourceAction>
              <Text size="1" color="gray600">
                {resource.description}
              </Text>
            </ResourceText>
            <ResourceAction>
              <Button as="span" size="1" variant="outline">
                {resource.action}
              </Button>
            </ResourceAction>
          </ResourceLink>
        );
      })}
    </ResourceList>
  </Box>
);

let StatStrip = ({
  stats,
  getStatCount
}: {
  stats: Stat[];
  getStatCount: (stat: Stat) => number | null;
}) => (
  <StatGrid>
    {stats.map(stat => {
      let count = getStatCount(stat);

      return (
        <StatTile key={stat.label} to={stat.to}>
          <Text size="1" color="gray800" weight="medium">
            {stat.label}
          </Text>

          <Text size="6" weight="strong">
            {count === null ? '...' : count.toLocaleString()}
          </Text>
        </StatTile>
      );
    })}
  </StatGrid>
);

let RecentEnclavesBox = ({
  enclaves,
  enclavePath
}: {
  enclaves: ReturnType<typeof useLastUsedEnclaves>;
  enclavePath: string;
}) => (
  <Box title="Recently Used Enclaves" description="Runtime environments with recent activity.">
    <EnclaveList>
      {enclaves.data?.items.length ? (
        enclaves.data.items.map(enclave => (
          <EnclaveRow key={enclave.id} to={enclavePath}>
            <ResourceText>
              <Text size="2" weight="strong">
                {enclave.name}
              </Text>
              <Text size="1" color="gray600">
                {enclave.providerDeploymentId}
              </Text>
            </ResourceText>
            <Text size="1" color="gray600">
              {enclave.lastUsedAt ? <RenderDate date={enclave.lastUsedAt} /> : 'No usage yet'}
            </Text>
          </EnclaveRow>
        ))
      ) : (
        <Text size="2" color="gray600">
          {enclaves.isLoading
            ? 'Loading recently used enclaves...'
            : 'No enclaves used recently.'}
        </Text>
      )}
    </EnclaveList>
  </Box>
);

let integrationsResourceCountResources = [
  'provider_deployments',
  'provider_configs',
  'provider_config_vaults',
  'provider_auth_configs',
  'provider_auth_credentials',
  'networks',
  'firewalls',
  'enclaves'
] satisfies ResourceCountResource[];

let configurationCountResources = [
  'provider_configs',
  'provider_config_vaults',
  'provider_auth_configs',
  'provider_auth_credentials'
] satisfies ResourceCountResource[];

export let IntegrationsOverviewPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let params = [organization.data, project.data, instance.data] as const;
  let resourceCounts = useResourceCounts(
    instance.data?.id,
    integrationsResourceCountResources
  );
  let lastUsedEnclaves = useLastUsedEnclaves(instance.data?.id, { limit: 3 });
  let countByResource = new Map(
    resourceCounts.data?.resources.map(resource => [resource.resource, resource.count]) ?? []
  );
  let getCount = (resources: ResourceCountResource[]) => {
    if (!resourceCounts.data) return null;
    return resources.reduce(
      (count, resource) => count + (countByResource.get(resource) ?? 0),
      0
    );
  };
  let getResourceCount = (resource: Resource) => getCount(resource.countResources);
  let getStatCount = (stat: Stat) => getCount(stat.countResources);

  return (
    <ContentLayout>
      <PageHeader
        title="Integrations and MCP"
        description="Everything your apps and agents connect to, with the activity and configuration behind it."
        actions={
          <Link to={Paths.instance.providers(...params)}>
            <Button size="2" as="span" variant="outline">
              View All Providers
            </Button>
          </Link>
        }
      />

      <HomeProvidersTable limit={12} orderByUse="last_deployment_at" orderByRank />

      {/*
      <Spacer height={25} />

      <PageStack>
        <StatStrip
          stats={[
            {
              label: 'Deployments',
              to: Paths.organization.instance.providerDeployments(...params),
              countResources: ['provider_deployments']
            },
            {
              label: 'Configurations',
              to: Paths.instance.providerAuthConfigs(...params),
              countResources: configurationCountResources
            },
            {
              label: 'Enclaves',
              to: Paths.organization.instance.networkEnclaves(...params),
              countResources: ['enclaves']
            },
            {
              label: 'Networks',
              to: Paths.organization.instance.network(...params),
              countResources: ['networks', 'firewalls']
            }
          ]}
          getStatCount={getStatCount}
        />

        <ActivityGrid>
          <UsageScene
            title="Connection Activity"
            description="Sessions opened against your providers over time."
            entities={[{ type: 'provider' }]}
            entityNames={{ provider: 'Sessions' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />

          <RecentEnclavesBox
            enclaves={lastUsedEnclaves}
            enclavePath={Paths.organization.instance.networkEnclaves(...params)}
          />
        </ActivityGrid>

        <ChartGrid>
          <UsageScene
            title="Provider Usage"
            description="Requests handled by each provider in this instance."
            entities={[{ type: 'provider' }]}
            entityNames={{ provider: 'Providers' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />

          <UsageScene
            title="Tool Calls"
            description="Tool calls made through your provider connections."
            entities={[{ type: 'tool_call' }]}
            entityNames={{ tool_call: 'Tool calls' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />
        </ChartGrid>

        <ChartGrid>
          <UsageScene
            title="Provider Configs"
            description="Sessions that used a configured provider."
            entities={[{ type: 'provider_config' }]}
            entityNames={{ provider_config: 'Configs' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />

          <UsageScene
            title="Auth Configs"
            description="Usage attributed to each auth configuration."
            entities={[{ type: 'provider_auth_config' }]}
            entityNames={{ provider_auth_config: 'Auth Configs' }}
            from={7}
            interval={{ unit: 'day', count: 1 }}
            labelBy="owner"
          />
        </ChartGrid>

        <ResourceGrid>
          <ResourceBox
            title="Connections"
            description="What can this instance connect to?"
            resources={[
              {
                label: 'Deployments',
                description: 'Provider deployments available to apps and agents.',
                to: Paths.organization.instance.providerDeployments(...params),
                countResources: ['provider_deployments'],
                action: 'View',
                tone: 'green'
              },
              {
                label: 'Configurations',
                description: 'Auth configs, credentials, provider configs, and vaults.',
                to: Paths.instance.providerAuthConfigs(...params),
                countResources: configurationCountResources,
                action: 'Review',
                tone: 'blue'
              }
            ]}
            getResourceCount={getResourceCount}
          />

          <ResourceBox
            title="Compute"
            description="Where and how does work run?"
            resources={[
              {
                label: 'Network',
                description: 'Firewall policy, public IPs, and network settings.',
                to: Paths.organization.instance.network(...params),
                countResources: ['networks', 'firewalls'],
                action: 'Open',
                tone: 'green'
              },
              {
                label: 'Enclaves',
                description: 'Runtime isolation for provider deployments.',
                to: Paths.organization.instance.networkEnclaves(...params),
                countResources: ['enclaves'],
                action: 'Inspect',
                tone: 'orange'
              }
            ]}
            getResourceCount={getResourceCount}
          />
        </ResourceGrid>
      </PageStack>
      */}
    </ContentLayout>
  );
};
