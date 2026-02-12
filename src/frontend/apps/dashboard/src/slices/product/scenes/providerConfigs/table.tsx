import { renderWithPagination } from '@metorial/data-hooks';
import { useProviderConfigs } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderConfigsTable = ({
  instanceId,
  providerDeploymentId
}: {
  instanceId: string;
  providerDeploymentId: string;
}) => {
  let configs = useProviderConfigs(instanceId, providerDeploymentId);

  return renderWithPagination(configs)(configs => (
    <>
      <Table
        headers={['Name', 'Created']}
        data={configs.data.items.map(config => ({
          data: [
            <Text size="2" weight="strong">
              {config.name ?? <span style={{ color: theme.colors.gray600 }}>Unnamed</span>}
              {config.description && (
                <Text size="2" color="gray600">
                  {config.description.slice(0, 60)}
                  {config.description.length > 60 ? '...' : ''}
                </Text>
              )}
            </Text>,
            <RenderDate date={config.createdAt} />
          ]
        }))}
      />

      {configs.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No configs found.
        </Text>
      )}
    </>
  ));
};
