import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigs
} from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderConfigVaultConfigsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerConfigVaultId } = useParams();

  let configs = useProviderConfigs(instance.data?.id, {
    providerConfigVaultId
  });

  return renderWithPagination(configs)(configs => (
    <>
      <Table
        headers={['Name', 'ID', 'Created']}
        data={configs.data.items.map(config => ({
          href: Paths.instance.providerConfig(
            organization.data,
            project.data,
            instance.data,
            config.id
          ),
          data: [
            <Text size="2" weight="strong">
              {config.name ?? <span style={{ color: theme.colors.gray600 }}>Unnamed</span>}
            </Text>,
            <ID id={config.id} />,
            <RenderDate date={config.createdAt} />
          ]
        }))}
      />

      {configs.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No configs created from this vault yet.
        </Text>
      )}
    </>
  ));
};
