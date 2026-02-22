import { renderWithPagination } from '@metorial/data-hooks';
import { useProviderAuthConfigs } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderAuthConfigsTable = ({
  instanceId,
  providerDeploymentId
}: {
  instanceId: string;
  providerDeploymentId: string;
}) => {
  let authConfigs = useProviderAuthConfigs(instanceId, providerDeploymentId);
  let formatType = (type: string | null | undefined) => {
    if (type === 'oauth_automated') return 'OAuth (Automated)';
    if (type === 'oauth_manual') return 'OAuth (Manual)';
    return 'Manual';
  };

  return renderWithPagination(authConfigs)(authConfigs => (
    <>
      <Table
        headers={['Name', 'Auth Method', 'Type', 'Created']}
        data={authConfigs.data.items.map(config => ({
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
            <Text size="2">{config.authMethod?.name ?? config.authMethod?.key ?? '—'}</Text>,
            <Text size="2">{formatType(config.type)}</Text>,
            <RenderDate date={config.createdAt} />
          ]
        }))}
      />

      {authConfigs.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No auth configs found.
        </Text>
      )}
    </>
  ));
};
