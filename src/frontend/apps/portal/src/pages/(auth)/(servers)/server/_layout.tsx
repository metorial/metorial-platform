import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { Badge, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { DeployServerButton } from '../../../../scenes/servers/deploy';
import { useServerListing } from '../../../../state/consumer/listings';
import { useServer } from '../../../../state/consumer/servers';
import { usePaths } from '../../../../state/portal/path';

export let ServerLayout = () => {
  let { serverId } = useParams();
  let server = useServer(serverId);
  let listing = useServerListing(serverId);
  let Paths = usePaths();

  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title={server.data?.name ?? '...'}
        description={server.data?.description ?? undefined}
        top={
          (listing.data?.isVerified ||
            listing.data?.isOfficial ||
            listing.data?.isMetorial) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {listing.data?.isVerified && <Badge color="blue">Verified</Badge>}
              {(listing.data?.isOfficial || listing.data?.isMetorial) && (
                <Badge color="gray">Official</Badge>
              )}
            </div>
          )
        }
        pagination={[
          {
            label: 'Servers',
            href: Paths.servers()
          },
          {
            label: server.data?.name,
            href: Paths.server(server.data?.id ?? serverId)
          }
        ]}
        actions={
          <>
            <DeployServerButton serverId={server.data?.id!} />
          </>
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Overview',
            to: Paths.server(server.data?.id)
          },
          {
            label: 'Deployments',
            to: Paths.server(server.data?.id, 'deployments')
          }
        ]}
      />

      {renderWithLoader({ server })(() => (
        <Outlet />
      ))}
    </ContentLayout>
  );
};
