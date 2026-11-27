import { EmptyState } from '@metorial/empty-state';
import { useCurrentInstance } from '@metorial/state';
import { ProviderConfigsOverviewTable } from '../../../scenes/providerConfigs/overviewTable';
import { showCreateProviderConfigFlow } from '../../../scenes/providerCreationFlows';

export let ProviderConfigsOverviewPage = () => {
  let instance = useCurrentInstance();

  return (
    <ProviderConfigsOverviewTable
      emptyState={{
        initial: () => (
          <EmptyState
            title="Create your first config"
            description="Configs let you save reusable provider settings for this instance."
            action={{
              label: 'Create Config',
              onClick: () => {
                if (instance.data?.id) {
                  showCreateProviderConfigFlow(instance.data.id);
                }
              }
            }}
          />
        )
      }}
    />
  );
};
