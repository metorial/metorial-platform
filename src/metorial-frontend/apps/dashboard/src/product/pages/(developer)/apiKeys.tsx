import { ApiKeysScene } from '../../scenes/apiKeys';
import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';

export let ProjectDeveloperApiKeysPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <ContentLayout>
      <PaginationSearchParamsProvider enabled>
        <ApiKeysScene
          tableLayout="product"
          header={{
            title: 'API Keys',
            description: 'Manage API keys and applications for this environment.'
          }}
          filter={{
            type: 'instance_access_token',
            instanceId: instance.data.id
          }}
        />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  ));
};
