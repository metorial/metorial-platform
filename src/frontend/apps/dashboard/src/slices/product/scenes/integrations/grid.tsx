import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  IntegrationPreview,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIntegrations
} from '@metorial/state';
import { Avatar, Text, theme } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { Link, useNavigate } from 'react-router-dom';
import { styled } from 'styled-components';
import { EmptyState } from '../../../../components/emptyState';
import { showIntegrationFormModal } from './modal';

let Alias = styled.div`
  background: ${theme.colors.gray300};
  min-height: 26px;
  border-radius: 999px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  overflow-wrap: anywhere;
`;

let getStatusColor = (status: IntegrationPreview['status']) => {
  if (status === 'active') return 'green';
  if (status === 'archived') return 'gray';
  return 'red';
};

export let IntegrationsGrid = (p: { instanceId: string; search?: string }) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let integrations = useIntegrations(p.instanceId, {
    order: 'desc',
    search: p.search || undefined,
    status: ['active', 'archived']
  });

  let showCreateIntegrationModal = () => {
    if (!instance.data) return;

    showIntegrationFormModal({
      type: 'create',
      instanceId: instance.data.id,
      onCreate: integration => {
        navigate(
          Paths.instance.integration(
            organization.data,
            project.data,
            instance.data,
            integration.id
          )
        );
      }
    });
  };

  return renderWithPagination(integrations)(integrations => (
    <>
      {integrations.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {integrations.data.items.map(integration => (
            <Link
              key={integration.id}
              to={Paths.instance.integration(
                organization.data,
                project.data,
                instance.data,
                integration.id
              )}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ItemGrid.Item
                entity={{ id: integration.id, hasUsage: true }}
                title={integration.name}
                description={integration.description}
                height={220}
                icon={<Avatar entity={integration} size={30} />}
                bottom={
                  <div style={{ display: 'flex' }}>
                    <Alias>{integration.slug}</Alias>
                  </div>
                }
              />
            </Link>
          ))}
        </ItemGrid.Root>
      )}

      {integrations.data.items.length === 0 && p.search && (
        <Text size="2" color="gray600">
          No integrations found.
        </Text>
      )}

      {integrations.data.items.length === 0 && !p.search && (
        <EmptyState
          extra="Integrations"
          title="Create your first integration"
          description="Integrations define reusable provider contracts that can be configured once and materialized into integration instances."
          action={{
            label: 'Create Integration',
            onClick: showCreateIntegrationModal
          }}
        />
      )}
    </>
  ));
};
