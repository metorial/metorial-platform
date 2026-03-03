import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCurrentOrganization, useCurrentProject, useProviderConfigVaults } from '@metorial/state';
import { Button, Flex, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { showProviderConfigVaultFormModal } from '../../../scenes/providerConfigVaults/modal';

export let ProviderDeploymentConfigVaultsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();

  let vaults = useProviderConfigVaults(instance.data?.id, {
    providerDeploymentId: providerDeploymentId ?? undefined
  });

  return renderWithPagination(vaults)(vaults => (
    <>
      <Button
        size="2"
        onClick={() =>
          showProviderConfigVaultFormModal({
            type: 'create',
            instanceId: instance.data?.id,
            providerDeploymentId: providerDeploymentId!,
            onCreate: vault => {
              if (!instance.data) return;

              navigate(
                Paths.instance.providerConfigVault(
                  organization.data,
                  project.data,
                  instance.data,
                  vault.id
                )
              );
            }
          })
        }
      >
        Create Vault
      </Button>

      <Spacer size={15} />

      <Table
        headers={['Name', 'Description', 'Created', 'Updated']}
        data={vaults.data.items.map(vault => ({
          href: Paths.instance.providerConfigVault(
            organization.data,
            project.data,
            instance.data,
            vault.id
          ),
          data: [
            <Text size="2" weight="strong">
              {vault.name}
            </Text>,
            <Text size="2" color="gray600">
              {vault.description ?? <span style={{ color: theme.colors.gray500 }}>—</span>}
            </Text>,
            <RenderDate date={vault.createdAt} />,
            <RenderDate date={vault.updatedAt} />
          ]
        }))}
      />

      {vaults.data.items.length === 0 && (
        <Flex justify="center" style={{ marginTop: 12 }}>
          <Text size="2" color="gray600">
            No config vaults found for this deployment.
          </Text>
        </Flex>
      )}
    </>
  ));
};
