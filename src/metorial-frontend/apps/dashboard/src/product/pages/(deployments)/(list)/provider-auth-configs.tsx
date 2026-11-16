import { EmptyState } from '@metorial/empty-state';
import { useCurrentInstance } from '@metorial/state';
import { ProviderAuthConfigsOverviewTable } from '../../../scenes/providerAuthConfigs/overviewTable';
import { showCreateProviderAuthConfigFlow } from '../../../scenes/providerCreationFlows';

export let ProviderAuthConfigsOverviewPage = () => {
  let instance = useCurrentInstance();

  return (
    <ProviderAuthConfigsOverviewTable
      emptyState={{
        initial: () => (
          <EmptyState
            title="Create your first auth config"
            description="Auth configs connect providers to the authentication settings your instance should use."
            action={{
              label: 'Create Auth Config',
              onClick: () => {
                if (instance.data?.id) {
                  showCreateProviderAuthConfigFlow(instance.data.id, { scope: 'provider' });
                }
              }
            }}
          />
        )
      }}
    />
  );
};
