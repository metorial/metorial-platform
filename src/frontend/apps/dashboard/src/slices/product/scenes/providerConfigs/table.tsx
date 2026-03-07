import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigs
} from '@metorial/state';
import { Badge, Flex, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderConfigsTable = ({
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
  let configs = useProviderConfigs(instanceId, providerDeploymentId, {
    order: 'desc',
    search
  });

  return renderWithPagination(configs)(configs => (
    <>
      <Table
        headers={['Name', 'Source', 'Type', 'Updated']}
        data={configs.data.items.map(config => ({
          href: Paths.instance.providerConfig(
            organization.data,
            project.data,
            instance.data,
            providerDeploymentId,
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
            config.fromVault ? (
              <Flex gap={6} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge color="purple" size="1">
                  Vault
                </Badge>
                <Text size="1" color="gray600">
                  {config.fromVault.name}
                </Text>
              </Flex>
            ) : (
              <Text size="2" color="gray600">
                Direct
              </Text>
            ),
            config.isDefault ? (
              <Badge color="blue" size="1">
                Default
              </Badge>
            ) : (
              <Badge color="gray" size="1">
                Custom
              </Badge>
            ),
            <RenderDate date={config.updatedAt} />
          ]
        }))}
      />

      {configs.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No configs for this deployment.
        </Text>
      )}
    </>
  ));
};
