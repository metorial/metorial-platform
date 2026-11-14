import { col, createDataList } from '@metorial/data-list';
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
import { Button } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { ApiKeysTable } from '../../scenes/apiKeys';
import { useInstanceContext } from '../../lib/dataList';

let previewLimit = 5;

let Resources = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let ApiKeysPreview = ({ instanceId }: { instanceId: string }) => {
  let keys = useApiKeys({ type: 'instance_access_token', instanceId });

  return renderWithLoader({ keys })(({ keys }) => <ApiKeysTable items={keys.data} compact />);
};

let DeploymentsPreviewList = createDataList<{ instanceId: string }>(
  'developer-deployments-preview'
)
  .context(useInstanceContext)
  .paginated(({ props, limit }) =>
    useProviderDeployments(props.instanceId, { limit, order: 'desc' })
  )
  .columns([col.name({ description: false, get: row => row.name ?? row.id }), col.createdAt()])
  .link((row, _props, ctx) =>
    Paths.instance.providerDeployment(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

let ConfigsPreviewList = createDataList<{ instanceId: string }>('developer-configs-preview')
  .context(useInstanceContext)
  .paginated(({ props, limit }) =>
    useProviderConfigs(props.instanceId, { limit, order: 'desc' })
  )
  .columns([col.name({ description: false, get: row => row.name ?? row.id }), col.createdAt()])
  .link((row, _props, ctx) =>
    Paths.instance.providerConfig(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

let AuthConfigsPreviewList = createDataList<{ instanceId: string }>(
  'developer-auth-configs-preview'
)
  .context(useInstanceContext)
  .paginated(({ props, limit }) =>
    useProviderAuthConfigs(props.instanceId, { limit, order: 'desc' })
  )
  .columns([col.name({ description: false, get: row => row.name ?? row.id }), col.createdAt()])
  .link((row, _props, ctx) =>
    Paths.instance.providerAuthConfig(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

let DeploymentsPreview = ({ instanceId }: { instanceId: string }) => (
  <DeploymentsPreviewList
    instanceId={instanceId}
    listVariant="preview"
    listLimit={previewLimit}
    emptyState="No deployments found."
  />
);

let ConfigsPreview = ({ instanceId }: { instanceId: string }) => (
  <ConfigsPreviewList
    instanceId={instanceId}
    listVariant="preview"
    listLimit={previewLimit}
    emptyState="No configs found."
  />
);

let AuthConfigsPreview = ({ instanceId }: { instanceId: string }) => (
  <AuthConfigsPreviewList
    instanceId={instanceId}
    listVariant="preview"
    listLimit={previewLimit}
    emptyState="No auth configs found."
  />
);

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
