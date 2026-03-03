import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigVault,
  useProviderConfigs
} from '@metorial/state';
import { Attributes, RenderDate, Spacer, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';

export let ProviderConfigVaultOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerConfigVaultId } = useParams();
  let vault = useProviderConfigVault(instance.data?.id, providerConfigVaultId);
  let configs = useProviderConfigs(
    instance.data?.id,
    vault.data?.deployment?.id,
    vault.data?.id ? { providerConfigVaultId: vault.data.id } : undefined
  );

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

      <Spacer size={20} />

      <Text size="4" weight="strong">
        Used By Configs
      </Text>

      <Spacer size={10} />

      <Table
        headers={['Name', 'Default', 'Created']}
        data={(configs.data?.items ?? []).map(config => ({
          href: Paths.instance.providerConfig(
            organization.data,
            project.data,
            instance.data,
            vault.data.deployment?.id,
            config.id
          ),
          data: [
            <Text size="2" weight="strong">
              {config.name ?? config.id}
            </Text>,
            config.isDefault ? 'Yes' : 'No',
            <RenderDate date={config.createdAt} />
          ]
        }))}
      />

      {(configs.data?.items?.length ?? 0) === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No configs are currently using this vault.
        </Text>
      )}
    </>
  ));
};
