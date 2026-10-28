import type { GetTypeOfPresentable, PresenterContext } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(async ({ where }: any) =>
    where.providerOid.in.map((providerOid: bigint) => ({
      oid: providerOid + 1000n,
      tenantOid: where.tenantOid,
      providerOid,
      providerTypeOid: 1n,
      slug: `stored-${where.tenantOid}-${providerOid}`
    }))
  )
}));

vi.mock('../../../../../products/integrations/db/src/db', () => ({
  db: { tenantOAuthCallbackUrl: { findMany } }
}));

vi.mock('../../../../../products/integrations/db/src/env', () => ({
  env: { service: { INTEGRATIONS_API_URL: 'https://integrations.example.com' } }
}));

vi.mock('../../../../../products/integrations/db/src/id', () => ({
  getId: () => ({ id: 'test' })
}));

vi.mock(
  '@metorial-subspace/db',
  async () => import('../../../../../products/integrations/db/src/utils/getOAuthCallbackUrl')
);

vi.mock('@metorial/db', () => ({
  getImageUrl: async ({ id }: { id: string }) => `https://images.example.com/${id}`
}));

import type { providerListingType } from '../../../types';
import {
  dashboardProviderListingPresenter,
  v1ProviderListingPresenter
} from './providerListing';
import { v1ProviderTypePresenter } from './providerType';

let context: PresenterContext = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'organization_management'
};

let listingInput = (providerOid: bigint, tenantOid = 1n) =>
  ({
    tenant: { oid: tenantOid, urlKey: `tenant${tenantOid}` },
    providerListing: {
      id: `plg_${providerOid}`,
      name: `Provider ${providerOid}`,
      slug: `provider-${providerOid}`,
      skills: [],
      categories: [],
      collections: [],
      groups: [],
      provider: {
        oid: providerOid,
        id: `pro_${providerOid}`,
        tag: `provider${providerOid}`,
        publisher: { id: 'pub_test' },
        type: {
          oid: 1n,
          shortKey: 'test',
          attributes: {
            backend: 'mcp.remote',
            triggers: { status: 'disabled' },
            config: { status: 'disabled' },
            auth: {
              status: 'enabled',
              oauth: { status: 'enabled' },
              export: { status: 'disabled' },
              import: { status: 'disabled' }
            }
          }
        }
      }
    }
  }) as unknown as GetTypeOfPresentable<typeof providerListingType>;

describe('provider listing callback URL queries', () => {
  beforeEach(() => {
    findMany.mockClear();
  });

  it('loads callback URLs once for a full dashboard page and reuses them for provider types', async () => {
    let inputs = Array.from({ length: 100 }, (_, index) => listingInput(BigInt(index + 1)));

    let listings = await Promise.all(
      inputs.map(input => dashboardProviderListingPresenter.present(input, context).run())
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where.providerOid.in).toHaveLength(100);

    for (let [index, listing] of listings.entries()) {
      let url = `https://integrations.example.com/oauth-callback/stored-1-${index + 1}`;

      expect(listing.provider.oauth?.callback_url).toBe(url);
      expect(listing.provider.type.auth).toMatchObject({
        oauth: { oauth_callback_url: url }
      });
    }
  });

  it('keeps callback URLs isolated between tenants', async () => {
    let listings = await Promise.all(
      [1n, 2n].map(tenantOid =>
        dashboardProviderListingPresenter.present(listingInput(10n, tenantOid), context).run()
      )
    );

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(listings.map(listing => listing.provider.oauth?.callback_url)).toEqual([
      'https://integrations.example.com/oauth-callback/stored-1-10',
      'https://integrations.example.com/oauth-callback/stored-2-10'
    ]);
  });

  it('keeps the public listing callback URL', async () => {
    let listing = await v1ProviderListingPresenter.present(listingInput(10n), context).run();

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(listing.provider.oauth?.callback_url).toBe(
      'https://integrations.example.com/oauth-callback/stored-1-10'
    );
  });

  it('still resolves callback URLs when a provider type is presented directly', async () => {
    let {
      tenant,
      providerListing: { provider }
    } = listingInput(10n);

    let type = await v1ProviderTypePresenter
      .present({ providerType: provider.type, provider, tenant }, context)
      .run();

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(type.auth).toMatchObject({
      oauth: {
        oauth_callback_url: 'https://integrations.example.com/oauth-callback/stored-1-10'
      }
    });
  });

  it('does not query callback URLs when OAuth is disabled', async () => {
    let input = listingInput(10n);
    input.providerListing.provider.type.attributes.auth = { status: 'disabled' };

    let listing = await dashboardProviderListingPresenter.present(input, context).run();

    expect(findMany).not.toHaveBeenCalled();
    expect(listing.provider.oauth).toBeNull();
    expect(listing.provider.type.auth).toEqual({ status: 'disabled' });
  });
});
