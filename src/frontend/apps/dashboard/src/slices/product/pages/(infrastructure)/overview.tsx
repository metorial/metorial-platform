import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

let ResourceGrid = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
`;

let ResourceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let ResourceLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: ${theme.colors.gray100};
    border-color: ${theme.colors.gray400};
  }
`;

let ResourceText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

type Resource = {
  label: string;
  description: string;
  to: string;
};

let ResourceBox = ({
  title,
  description,
  resources
}: {
  title: string;
  description: string;
  resources: Resource[];
}) => (
  <Box title={title} description={description}>
    <ResourceList>
      {resources.map(resource => (
        <ResourceLink key={resource.to} to={resource.to}>
          <ResourceText>
            <Text size="2" weight="strong">
              {resource.label}
            </Text>
            <Text size="1" color="gray600">
              {resource.description}
            </Text>
          </ResourceText>
          <Button as="span" size="1" variant="outline">
            Open
          </Button>
        </ResourceLink>
      ))}
    </ResourceList>
  </Box>
);

export let InfrastructureOverviewPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let params = [organization.data, project.data, instance.data] as const;

  return (
    <ContentLayout>
      <PageHeader
        title="Infra"
        description="Review the connection, compute, and identity resources that power this instance."
      />

      <ResourceGrid>
        <ResourceBox
          title="Connections"
          description="Deploy and configure providers used by your applications."
          resources={[
            {
              label: 'Deployments',
              description: 'Provider deployments available to this instance.',
              to: Paths.instance.providerDeployments(...params)
            },
            {
              label: 'Configurations',
              description: 'Auth configs, credentials, provider configs, and vaults.',
              to: Paths.instance.providerDeployments(...params, 'auth-configs')
            },
            {
              label: 'Templates',
              description: 'Reusable session templates for provider access.',
              to: Paths.instance.sessionTemplates(...params)
            }
          ]}
        />

        <ResourceBox
          title="Compute"
          description="Inspect network controls and runtime isolation resources."
          resources={[
            {
              label: 'Compute Overview',
              description: 'Magic Network, firewall options, and recent activity.',
              to: Paths.instance.security(...params)
            },
            {
              label: 'Network',
              description: 'Firewalls, public IPs, and network settings.',
              to: Paths.instance.network(...params)
            },
            {
              label: 'Enclaves',
              description: 'Provider deployment enclaves and recent usage.',
              to: Paths.instance.networkEnclaves(...params)
            }
          ]}
        />

        <ResourceBox
          title="Identity"
          description="Manage workforce accounts, agents, actors, and identities."
          resources={[
            {
              label: 'Accounts',
              description: 'Workforce accounts and their linked identity actors.',
              to: Paths.instance.identity.consumers(...params)
            },
            {
              label: 'Agents',
              description: 'First-class agents and linked clients.',
              to: Paths.instance.identity.agents(...params)
            },
            {
              label: 'Identities',
              description: 'Identity records, actors, delegations, and configs.',
              to: Paths.instance.identity.identities(...params)
            }
          ]}
        />
      </ResourceGrid>
    </ContentLayout>
  );
};
