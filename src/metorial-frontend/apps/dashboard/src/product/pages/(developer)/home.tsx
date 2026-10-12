import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useApiKeys,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderDeployments,
  useProviderConfigs,
  useProviderAuthConfigs
} from '@metorial/state';
import { Button, RenderDate, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { ApiKeysTable } from '../../scenes/apiKeys';
import { getVisibleApiKeys } from '../../scenes/apiKeys/visibleApiKeys';

let previewLimit = 5;

let Resources = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let ApiKeysPreview = ({ instanceId }: { instanceId: string }) => {
  let keys = useApiKeys({ type: 'instance_access_token', instanceId });

  return renderWithLoader({ keys })(({ keys }) => {
    let items = getVisibleApiKeys(keys.data).slice(0, previewLimit);

    return items.length ? (
      <ApiKeysTable items={items} compact />
    ) : (
      <Text size="2" color="gray600">
        No API keys found.
      </Text>
    );
  });
};

let DeploymentsPreview = ({ instanceId }: { instanceId: string }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let deployments = useProviderDeployments(instanceId, { limit: previewLimit, order: 'desc' });

  return renderWithLoader({ deployments })(({ deployments }) =>
    deployments.data.items.length ? (
      <Table
        headers={['Name', 'Created']}
        data={deployments.data.items.slice(0, previewLimit).map(item => ({
          href: Paths.instance.providerDeployment(
            organization.data,
            project.data,
            instance.data,
            item.id
          ),
          data: [item.name ?? item.id, <RenderDate date={item.createdAt} />]
        }))}
      />
    ) : (
      <Text size="2" color="gray600">
        No deployments found.
      </Text>
    )
  );
};

let ConfigsPreview = ({ instanceId }: { instanceId: string }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let configs = useProviderConfigs(instanceId, { limit: previewLimit, order: 'desc' });

  return renderWithLoader({ configs })(({ configs }) =>
    configs.data.items.length ? (
      <Table
        headers={['Name', 'Created']}
        data={configs.data.items.slice(0, previewLimit).map(item => ({
          href: Paths.instance.providerConfig(
            organization.data,
            project.data,
            instance.data,
            item.id
          ),
          data: [item.name ?? item.id, <RenderDate date={item.createdAt} />]
        }))}
      />
    ) : (
      <Text size="2" color="gray600">
        No configs found.
      </Text>
    )
  );
};

let AuthConfigsPreview = ({ instanceId }: { instanceId: string }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let configs = useProviderAuthConfigs(instanceId, { limit: previewLimit, order: 'desc' });

  return renderWithLoader({ configs })(({ configs }) =>
    configs.data.items.length ? (
      <Table
        headers={['Name', 'Created']}
        data={configs.data.items.slice(0, previewLimit).map(item => ({
          href: Paths.instance.providerAuthConfig(
            organization.data,
            project.data,
            instance.data,
            item.id
          ),
          data: [item.name ?? item.id, <RenderDate date={item.createdAt} />]
        }))}
      />
    ) : (
      <Text size="2" color="gray600">
        No auth configs found.
      </Text>
    )
  );
};

export let DeveloperHomePage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();

  return renderWithLoader({ organization, project, instance })(({ instance }) => {
    let params = [organization.data, project.data, instance.data] as const;
    let resources = [
      {
        title: 'API Keys',
        description: 'Manage API keys for this environment.',
        to: Paths.instance.developer(...params, 'api-keys'),
        content: <ApiKeysPreview instanceId={instance.data.id} />
      },
      {
        title: 'Deployments',
        description: 'Manage your integration deployments.',
        to: Paths.instance.providerDeployments(...params),
        content: <DeploymentsPreview instanceId={instance.data.id} />
      },
      {
        title: 'Configs',
        description: 'Manage reusable provider configuration profiles.',
        to: Paths.instance.providerConfigs(...params),
        content: <ConfigsPreview instanceId={instance.data.id} />
      },
      {
        title: 'Auth Configs',
        description: 'Manage authenticated connections to your providers.',
        to: Paths.instance.providerAuthConfigs(...params),
        content: <AuthConfigsPreview instanceId={instance.data.id} />
      }
    ];

    return (
      <ContentLayout>
        <PageHeader
          title="Developer"
          description="Manage API access and integration deployment resources for this environment."
        />
        <Resources>
          {resources.map(resource => (
            <Box
              key={resource.title}
              title={resource.title}
              description={resource.description}
              rightActions={
                <Link to={resource.to}>
                  <Button as="span" size="1">
                    View More
                  </Button>
                </Link>
              }
            >
              {resource.content}
            </Box>
          ))}
        </Resources>
      </ContentLayout>
    );
  });
};
