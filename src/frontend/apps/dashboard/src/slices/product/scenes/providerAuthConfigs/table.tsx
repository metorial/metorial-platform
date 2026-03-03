import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigs
} from '@metorial/state';
import { Badge, RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderAuthConfigsTable = ({
  instanceId,
  providerDeploymentId
}: {
  instanceId: string;
  providerDeploymentId: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let authConfigs = useProviderAuthConfigs(instanceId, providerDeploymentId);
  let formatType = (type: string | null | undefined) => {
    if (type === 'oauth_automated') return 'OAuth (Automated)';
    if (type === 'oauth_manual') return 'OAuth (Manual)';
    return 'Manual';
  };
  let formatSource = (source: string | null | undefined) => {
    if (source === 'setup_session') return 'Setup Session';
    if (source === 'system') return 'System';
    return 'Manual';
  };

  return renderWithPagination(authConfigs)(authConfigs => (
    <>
      <Table
        headers={['Name', 'Auth Method', 'Type', 'Source', 'Status', 'Default', 'Created']}
        data={authConfigs.data.items.map(config => ({
          href: Paths.instance.providerAuthConfig(
            organization.data,
            project.data,
            instance.data,
            config.deploymentPreview?.id ?? providerDeploymentId,
            config.id
          ),
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
            <Text size="2">{formatSource(config.source)}</Text>,
            <Badge color={config.status === 'active' ? 'green' : 'gray'}>{config.status}</Badge>,
            config.isDefault ? <Badge color="blue">Default</Badge> : <Text size="2">No</Text>,
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
