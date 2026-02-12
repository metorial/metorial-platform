import { renderWithPagination } from '@metorial/data-hooks';
import { useProviderTools } from '@metorial/state';
import { Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderToolsTable = ({
  instanceId,
  providerId,
  providerVersionId
}: {
  instanceId: string;
  providerId: string;
  providerVersionId?: string;
}) => {
  let tools = useProviderTools(instanceId, providerId, { providerVersionId });

  return renderWithPagination(tools)(tools => (
    <>
      <Table
        headers={['Name', 'Key', 'Description']}
        data={tools.data.items.map(tool => ({
          data: [
            <Text size="2" weight="strong">
              {tool.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Unnamed</span>
              )}
            </Text>,
            <Text size="2" style={{ fontFamily: 'monospace' }}>
              {tool.key}
            </Text>,
            <Text size="2" color="gray600">
              {tool.description?.slice(0, 80)}
              {(tool.description?.length ?? 0) > 80 ? '...' : ''}
            </Text>
          ]
        }))}
      />

      {tools.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No tools found.
        </Text>
      )}
    </>
  ));
};
