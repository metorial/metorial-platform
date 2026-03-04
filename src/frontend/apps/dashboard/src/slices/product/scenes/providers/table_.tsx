import {
  DashboardInstanceProviderListingsGetOutput,
  DashboardInstanceProviderListingsListQuery
} from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviderListings } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderTable = (
  filter: DashboardInstanceProviderListingsListQuery & {
    getUrl: (listing: DashboardInstanceProviderListingsGetOutput) => string;
  }
) => {
  let listings = useProviderListings(filter);
  let instance = useCurrentInstance();

  return renderWithPagination(listings)(servers => (
    <>
      <Table
        headers={['Info', 'Status', 'Created']}
        data={servers.data.items.map(listing => ({
          data: [
            <div>
              <Text size="2" weight="strong">
                {listing.name}
              </Text>
              {listing.description && (
                <Text size="2" color="gray600">
                  {listing.description.slice(0, 60)}
                  {listing.description.length > 60 ? '...' : ''}
                </Text>
              )}
            </div>,
            listing.attributes.isOfficial
              ? 'Official'
              : listing.attributes.isVerified
                ? 'Verified'
                : 'Community',
            <RenderDate date={listing.createdAt} />
          ],
          href: filter.getUrl
            ? filter.getUrl(listing)
            : Paths.instance.provider(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                listing.provider?.id ?? listing.id
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
