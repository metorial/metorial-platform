import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfig,
  useProviderDeployment
} from '@metorial/state';
import { Attributes, Badge, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';

export let ProviderConfigOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerDeploymentId, providerConfigId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let config = useProviderConfig(instance.data?.id, providerDeploymentId, providerConfigId);

  return renderWithLoader({ config })(({ config }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: config.data.name ?? '—'
          },
          {
            label: 'Description',
            content: config.data.description ?? '—'
          },
          {
            label: 'ID',
            content: <ID id={config.data.id} />
          },
          {
            label: 'Default',
            content: config.data.isDefault ? <Badge color="blue">Default</Badge> : 'No'
          },
          {
            label: 'Provider',
            content: deployment.data?.providerId ?? '—'
          },
          {
            label: 'Deployment',
            content: deployment.data?.name ?? '—'
          },
          {
            label: 'Specification ID',
            content: <ID id={config.data.specificationId} />
          },
          {
            label: 'From Vault',
            content: config.data.fromVault ? (
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
            ) : (
              '—'
            )
          },
          {
            label: 'Created',
            content: config.data.createdAt ? <RenderDate date={config.data.createdAt} /> : '—'
          },
          {
            label: 'Updated',
            content: config.data.updatedAt ? <RenderDate date={config.data.updatedAt} /> : '—'
          }
        ]}
      />
    </>
  ));
};
