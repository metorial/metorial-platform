import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigVault
} from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';

export let ProviderConfigVaultOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerConfigVaultId } = useParams();
  let vault = useProviderConfigVault(instance.data?.id, providerConfigVaultId);

  return renderWithLoader({ vault })(({ vault }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: vault.data.name ?? '—'
          },
          {
            label: 'Description',
            content: vault.data.description ?? '—'
          },
          {
            label: 'ID',
            content: <ID id={vault.data.id} />
          },
          {
            label: 'Provider',
            content: vault.data.providerId ?? '—'
          },
          {
            label: 'Deployment',
            content: vault.data.deployment ? (
              <Link
                to={Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  vault.data.deployment.id
                )}
              >
                {vault.data.deployment.name ?? vault.data.deployment.id}
              </Link>
            ) : (
              '—'
            )
          },
          {
            label: 'Created',
            content: vault.data.createdAt ? <RenderDate date={vault.data.createdAt} /> : '—'
          },
          {
            label: 'Updated',
            content: vault.data.updatedAt ? <RenderDate date={vault.data.updatedAt} /> : '—'
          }
        ]}
      />

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how this config vault is being used in your instance."
        entities={[{ type: 'provider_config_vault', id: vault.data.id }]}
        entityNames={{
          [vault.data.id]: vault.data.name ?? vault.data.id
        }}
      />
    </>
  ));
};
