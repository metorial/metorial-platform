import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ServersListingsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useCurrentInstance, useServerListings } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ServersTable = (filter: ServersListingsListQuery) => {
  let listings = useServerListings(filter);
  let instance = useCurrentInstance();

  return renderWithPagination(listings)(servers => (
    <>
      <Table
        headers={['Info', 'Vendor', 'Installed']}
        data={servers.data.items.map(listing => ({
          data: [
            <div>
              <Text size="2" weight="strong">
                {listing.name}
              </Text>
              <Text size="2" color="gray600">
                {listing.description.slice(0, 60)}
                {listing.description.length > 60 ? '...' : ''}
              </Text>
            </div>,
            listing.vendor?.name ?? 'Unknown',
            listing.installation ? <RenderDate date={listing.installation.createdAt} /> : 'N/A'
          ],
          href: Paths.instance.server(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            listing.server.id
          )
        }))}
      />

      {servers.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No servers found.
        </Text>
      )}
    </>
  ));
};
