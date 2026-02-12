import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { ServersTable } from '../../scenes/servers/table';

export let CommunityServersPage = () => {
  let instance = useCurrentInstance();

  return (
    <ContentLayout>
      <PageHeader
        title="Community Providers"
        description="Community providers are remote or managed providers that you have published for other Metorial users to access."
      ></PageHeader>

      <ServersTable
        onlyFromOrganization
        isPublic
        instanceId={instance.data?.instanceId}
        getUrl={listing =>
          Paths.instance.customServer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            listing.server.id,
            'listing'
          )
        }
      />
    </ContentLayout>
  );
};
