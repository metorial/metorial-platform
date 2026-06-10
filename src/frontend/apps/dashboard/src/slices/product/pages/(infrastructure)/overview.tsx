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
import { UsageScene } from '../../scenes/usage/usage';

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

let ResourceGrid = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(3, minmax(0, 1fr));

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
  hint: string;
  to: string;
  countResources: ResourceCountResource[];
  tone?: 'green' | 'blue' | 'orange' | 'gray';
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

let infrastructureResourceCountResources = [
  'provider_deployments',
  'provider_configs',
  'provider_config_vaults',
  'provider_auth_configs',
  'provider_auth_credentials',
  'session_templates',
  'networks',
  'firewalls',
  'enclaves',
  'accounts',
  'agents',
  'identity_actors',
  'identities',
  'identity_delegations',
  'identity_delegation_configs'
] satisfies ResourceCountResource[];

export let InfrastructureOverviewPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let params = [organization.data, project.data, instance.data] as const;
  let resourceCounts = useResourceCounts(
    instance.data?.id,
    infrastructureResourceCountResources
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
        title="Infra"
        description="Review the connection, compute, and identity resources that power your Metorial instance."
      />

      <PageStack>
        <StatStrip
          stats={[
            {
              label: 'Deployments',
              hint: 'Provider access',
              to: Paths.instance.providerDeployments(...params),
              countResources: ['provider_deployments'],
              tone: 'green'
            },
            {
              label: 'Configurations',
              hint: 'Auth and config',
              to: Paths.instance.providerDeployments(...params, 'auth-configs'),
              countResources: [
                'provider_configs',
                'provider_config_vaults',
                'provider_auth_configs',
                'provider_auth_credentials'
              ],
              tone: 'blue'
            },
            {
              label: 'Enclaves',
              hint: 'Runtime isolation',
              to: Paths.instance.networkEnclaves(...params),
              countResources: ['enclaves'],
              tone: 'orange'
            },
            {
              label: 'Agents',
              hint: 'Identity clients',
              to: Paths.instance.identity.agents(...params),
              countResources: ['agents'],
              tone: 'gray'
            }
          ]}
          getStatCount={getStatCount}
        />

        <ActivityGrid>
          <UsageScene
            title="Connection Activity"
            description="Recent activity across deployments and tool calls."
            entities={[{ type: 'provider_deployment' }, { type: 'tool_call' }]}
            entityNames={{
              provider_deployment: 'Sessions',
              'type:provider_deployment': 'Sessions',
              tool_call: 'Tool calls',
              'type:tool_call': 'Tool calls'
            }}
          />

          <RecentEnclavesBox
            enclaves={lastUsedEnclaves}
            enclavePath={Paths.instance.networkEnclaves(...params)}
          />
        </ActivityGrid>

        <ResourceGrid>
          <ResourceBox
            title="Connections"
            description="What can this instance connect to?"
            resources={[
              {
                label: 'Deployments',
                description: 'Provider deployments available to apps and agents.',
                to: Paths.instance.providerDeployments(...params),
                countResources: ['provider_deployments'],
                action: 'View',
                tone: 'green'
              },
              {
                label: 'Configurations',
                description: 'Auth configs, credentials, provider configs, and vaults.',
                to: Paths.instance.providerDeployments(...params, 'auth-configs'),
                countResources: [
                  'provider_configs',
                  'provider_config_vaults',
                  'provider_auth_configs',
                  'provider_auth_credentials'
                ],
                action: 'Review',
                tone: 'blue'
              },
              {
                label: 'Templates',
                description: 'Reusable session templates for provider access.',
                to: Paths.instance.sessionTemplates(...params),
                countResources: ['session_templates'],
                action: 'Open'
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
                to: Paths.instance.network(...params),
                countResources: ['networks', 'firewalls'],
                action: 'Open',
                tone: 'green'
              },
              {
                label: 'Enclaves',
                description: 'Runtime isolation for provider deployments.',
                to: Paths.instance.networkEnclaves(...params),
                countResources: ['enclaves'],
                action: 'Inspect',
                tone: 'orange'
              },
              {
                label: 'Compute Overview',
                description: 'Magic Network, firewall options, and recent activity.',
                to: Paths.instance.security(...params),
                countResources: ['networks', 'firewalls', 'enclaves'],
                action: 'Open'
              }
            ]}
            getResourceCount={getResourceCount}
          />

          <ResourceBox
            title="Identity"
            description="Who or what can access resources?"
            resources={[
              {
                label: 'Accounts',
                description: 'Workforce accounts and linked identity actors.',
                to: Paths.instance.identity.consumers(...params),
                countResources: ['accounts'],
                action: 'Open'
              },
              {
                label: 'Agents',
                description: 'First-class agents and linked clients.',
                to: Paths.instance.identity.agents(...params),
                countResources: ['agents'],
                action: 'Manage',
                tone: 'blue'
              },
              {
                label: 'Identities',
                description: 'Identity records, actors, delegations, and configs.',
                to: Paths.instance.identity.identities(...params),
                countResources: [
                  'identity_actors',
                  'identities',
                  'identity_delegations',
                  'identity_delegation_configs'
                ],
                action: 'Open'
              }
            ]}
            getResourceCount={getResourceCount}
          />
        </ResourceGrid>
      </PageStack>
    </ContentLayout>
  );
};
