import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { ProviderTable } from '../../scenes/providers/table_';

export let CommunityProvidersPage = () => {
  let instance = useCurrentInstance();

  return (
    <ContentLayout>
      <PageHeader
        title="Community Providers"
        description="Community providers are remote or managed providers that you have published for other Metorial users to access."
      ></PageHeader>

      <ProviderTable
        getUrl={listing =>
          Paths.instance.provider(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            listing.id
          )
        }
      />
    </ContentLayout>
  );
};
