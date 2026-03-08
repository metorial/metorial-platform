import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigs
} from '@metorial/state';
import { Badge, Flex, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

let formatType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return '-';
};

let formatSource = (source: string | null | undefined) => {
  if (source === 'setup_session') return 'Setup Session';
  if (source === 'system') return 'System';
  if (source === 'manual') return 'Manual';
  return '-';
};

export let ProviderAuthConfigsTable = ({
  instanceId,
  providerDeploymentId,
  search
}: {
  instanceId: string;
  providerDeploymentId: string;
  search?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let authConfigs = useProviderAuthConfigs(instanceId, providerDeploymentId, {
    order: 'desc',
    search
  });

  return renderWithPagination(authConfigs)(authConfigs => (
    <>
      <Table
        headers={['Name', 'Auth Method', 'Type', 'Source', 'Status', 'Default', 'Updated']}
        data={authConfigs.data.items.map(config => ({
          href: Paths.instance.providerAuthConfig(
            organization.data,
            project.data,
            instance.data,
            config.deploymentPreview?.id ?? providerDeploymentId,
            config.id
          ),
          data: [
            <Flex direction="column" gap={2}>
              <Text size="2" weight="strong">
                {config.name ?? 'Unnamed'}
              </Text>
              {config.description ? (
                <Text
                  size="1"
                  color="gray600"
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {config.description}
                </Text>
              ) : null}
            </Flex>,
            <Text size="2">{config.authMethod?.name ?? config.authMethod?.key ?? '-'}</Text>,
            <Text size="2">{formatType(config.type)}</Text>,
            <Text size="2">{formatSource(config.source)}</Text>,
            <Badge color={config.status === 'active' ? 'green' : 'gray'} size="1">
              {config.status}
            </Badge>,
            config.isDefault ? (
              <Badge color="blue" size="1">
                Default
              </Badge>
            ) : (
              <Text size="2" color="gray600">
                -
              </Text>
            ),
            <RenderDate date={config.updatedAt} />
          ]
        }))}
      />

      {authConfigs.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No auth configs for this deployment.
        </Text>
      )}
    </>
  ));
};
