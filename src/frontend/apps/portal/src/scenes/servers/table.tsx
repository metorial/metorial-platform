import {
  ServersListingsGetOutput,
  ServersListingsListQuery
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { renderWithPagination } from '@metorial/data-hooks';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useServerListings } from '../../state/consumer/listings';
import { usePaths } from '../../state/portal/path';

export let ProviderTable = (
  filter: ServersListingsListQuery & {
    getUrl: (listing: ServersListingsGetOutput) => string;
  }
) => {
  let Paths = usePaths();
  let listings = useServerListings(filter);

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
          href: filter.getUrl ? filter.getUrl(listing) : Paths.server(listing.server.id)
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
