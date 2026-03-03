import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfig,
  useProviderDeployment,
  useProviders
} from '@metorial/state';
import { Attributes, Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';

let formatType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return '—';
};

export let ProviderAuthConfigOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerDeploymentId, providerAuthConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let authConfig = useProviderAuthConfig(
    instance.data?.id,
    providerDeploymentId,
    providerAuthConfigId
  );
  let providers = useProviders(
    instance.data?.id,
    authConfig.data?.providerId ? { id: authConfig.data.providerId } : null
  );
  let provider = providers.data?.items?.[0] ?? null;
  let authMethod = authConfig.data?.authMethod;
  let credentials = authConfig.data?.credentials;
  let deploymentPreview = authConfig.data?.deploymentPreview;

  return renderWithLoader({ authConfig })(({ authConfig }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: authConfig.data.name ?? '—'
          },
          {
            label: 'Description',
            content: authConfig.data.description ?? '—'
          },
          {
            label: 'ID',
            content: <ID id={authConfig.data.id} />
          },
          {
            label: 'Type',
            content: formatType(authConfig.data.type)
          },
          {
            label: 'Source',
            content: authConfig.data.source ?? '—'
          },
          {
            label: 'Status',
            content: authConfig.data.status ? (
              <Badge color={authConfig.data.status === 'active' ? 'green' : 'gray'}>
                {authConfig.data.status}
              </Badge>
            ) : (
              '—'
            )
          },
          {
            label: 'Default',
            content: authConfig.data.isDefault ? <Badge color="blue">Default</Badge> : 'No'
          },
          {
            label: 'Provider',
            content: provider ? (
              <Text size="2" weight="strong">
                {provider.name ?? provider.id}
              </Text>
            ) : (
              deployment.data?.providerId ?? authConfig.data.providerId ?? '—'
            )
          },
          {
            label: 'Deployment',
            content: deploymentPreview ? (
              <Link
                to={Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  deploymentPreview.id
                )}
              >
                {deploymentPreview.name ?? deploymentPreview.id}
              </Link>
            ) : (
              deployment.data?.name ?? '—'
            )
          },
          {
            label: 'Auth Method',
            content: authMethod ? (
              <Text size="2">
                {authMethod.name} ({authMethod.type})
              </Text>
            ) : (
              '—'
            )
          },
          {
            label: 'Linked Credentials',
            content: credentials ? (
              <Link
                to={Paths.instance.providerAuthCredential(
                  organization.data,
                  project.data,
                  instance.data,
                  deploymentPreview?.id ?? providerDeploymentId,
                  credentials.id
                )}
              >
                {credentials.name ?? credentials.id}
              </Link>
            ) : (
              '—'
            )
          },
          {
            label: 'Created',
            content: authConfig.data.createdAt ? (
              <RenderDate date={authConfig.data.createdAt} />
            ) : (
              '—'
            )
          },
          {
            label: 'Updated',
            content: authConfig.data.updatedAt ? (
              <RenderDate date={authConfig.data.updatedAt} />
            ) : (
              '—'
            )
          }
        ]}
      />
    </>
  ));
};
