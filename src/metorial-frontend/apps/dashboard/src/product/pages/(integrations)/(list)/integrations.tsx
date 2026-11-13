import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useNavigate } from 'react-router-dom';
import { IntegrationsGrid } from '../../../scenes/integrations/grid';
import { showCreateIntegrationProviderFirstFlow } from '../../../scenes/integrations/providerPanelFlow';

export let IntegrationsPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  return (
    <IntegrationsGrid
      emptyState={{
        initial: () => (
          <EmptyState
            extra="Integrations"
            title="Create your first integration"
            description="Integrations define reusable provider contracts that can be configured once and materialized into integration instances."
            action={{
              label: 'Create Integration',
              onClick: () => {
                if (!instance.data) return;

                showCreateIntegrationProviderFirstFlow({
                  onCreate: integration =>
                    navigate(
                      Paths.instance.integration(
                        organization.data,
                        project.data,
                        instance.data,
                        integration.id
                      )
                    )
                });
              }
            }}
          />
        ),
        filtered: 'No integrations match the current filters.',
        search: 'No integrations found.'
      }}
    />
  );
};
