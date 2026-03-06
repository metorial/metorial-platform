import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderConfigVaults
} from '@metorial/state';
import { Button, Input, RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { showProviderConfigVaultFormModal } from '../../../scenes/providerConfigVaults/modal';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

let ProviderDeploymentConfigVaultsTable = ({
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
  let vaults = useProviderConfigVaults(instanceId, {
    order: 'desc',
    providerDeploymentId,
    search
  });

  return renderWithPagination(vaults)(vaults => (
    <>
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
            <Text
              size="2"
              color="gray600"
              style={{
                display: 'block',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {vault.description ?? '-'}
            </Text>,
            <RenderDate date={vault.createdAt} />,
            <RenderDate date={vault.updatedAt} />
          ]
        }))}
      />

      {vaults.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No config vaults for this deployment.
        </Text>
      )}
    </>
  ));
};

export let ProviderDeploymentConfigVaultsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { providerDeploymentId } = useParams();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  return renderWithLoader({ instance, organization, project })(({ instance }) => (
    <ProviderDeploymentTabSection
      intro="Vaults store reusable secret or shared configuration values for this deployment."
      actions={
        <Button
          size="2"
          onClick={() =>
            showProviderConfigVaultFormModal({
              type: 'create',
              instanceId: instance.data.id,
              providerDeploymentId: providerDeploymentId!,
              onCreate: vault => {
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
      }
      search={
        <Input
          label="Search"
          hideLabel
          size="2"
          placeholder="Search config vaults..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      }
    >
      <ProviderDeploymentConfigVaultsTable
        instanceId={instance.data.id}
        providerDeploymentId={providerDeploymentId!}
        search={searchDebounced}
      />
    </ProviderDeploymentTabSection>
  ));
};
