import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, updateProvider } = vi.hoisted(() => ({
  db: {
    providerListing: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn()
    },
    providerRun: { count: vi.fn(), findFirst: vi.fn() },
    sessionError: { count: vi.fn() },
    providerSetupSessionEvent: { count: vi.fn() }
  },
  updateProvider: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({ db }));

vi.mock('@metorial-subspace/connection-utils', () => ({
  GET_PAYLOAD_LIMIT_BYTES: 1024,
  presentOmittedBody: vi.fn()
}));

vi.mock('@metorial-subspace/module-catalog', () => ({
  providerService: { updateProvider }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({ getMetorialSolution: vi.fn() }));

vi.mock('./adminProviderTelemetryErrorGroup', () => ({
  adminProviderTelemetryErrorGroupService: {}
}));

vi.mock('./providerInvocation', () => ({ providerInvocationService: {} }));

vi.mock('./providerRunLogs', () => ({ providerRunLogsService: {} }));

vi.mock('./sessionMessage', () => ({
  sessionMessageBodyOmit: {},
  sessionMessageService: {}
}));

import { adminProviderTelemetryService } from './adminProviderTelemetry';

let range = {
  from: new Date('2026-10-20T00:00:00.000Z'),
  to: new Date('2026-10-27T00:00:00.000Z')
};

let listing = {
  id: 'pl_1',
  providerOid: 10n,
  name: 'Example Provider',
  slug: 'example',
  status: 'active',
  isDeprecated: true,
  provider: { id: 'prov_1', oid: 10n, providerVersions: [] }
};

describe('adminProviderTelemetryService provider lookup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.providerListing.findFirst.mockResolvedValue(null);
    db.providerRun.count.mockResolvedValue(5);
    db.sessionError.count.mockResolvedValue(1);
    db.providerSetupSessionEvent.count.mockResolvedValue(0);
    db.providerRun.findFirst.mockResolvedValue(null);
  });

  it.each(['undefined', 'prov_missing'])(
    'returns a service not-found error when reading %s',
    async providerId => {
      let request = adminProviderTelemetryService.getProvider({ providerId });

      await expect(request).rejects.toBeInstanceOf(ServiceError);
      await expect(request).rejects.toMatchObject({
        data: { status: 404, code: 'not_found', entity: 'provider', id: providerId }
      });
      expect(db.providerRun.count).not.toHaveBeenCalled();
    }
  );

  it('does not mutate a provider when the listing is missing', async () => {
    await expect(
      adminProviderTelemetryService.updateProvider({ providerId: 'prov_missing', name: 'New' })
    ).rejects.toMatchObject({
      data: { status: 404, code: 'not_found', entity: 'provider', id: 'prov_missing' }
    });

    expect(updateProvider).not.toHaveBeenCalled();
    expect(db.providerListing.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('presents matching first-party providers with distinct provider and listing IDs', async () => {
    db.providerListing.findFirst.mockResolvedValue(listing);

    let result = await adminProviderTelemetryService.getProvider({
      providerId: 'prov_1',
      range
    });

    expect(result).toMatchObject({
      id: 'prov_1',
      listing_id: 'pl_1',
      name: 'Example Provider',
      is_deprecated: true,
      metrics: { range, runs: 5, errors: 1, error_rate: 0.2 }
    });
    expect(db.providerListing.findFirst).toHaveBeenCalledWith({
      where: {
        ownerTenantOid: null,
        ownerSolutionOid: null,
        status: 'active',
        AND: [
          {
            OR: [
              { id: { in: ['prov_1'] } },
              { slug: { in: ['prov_1'] } },
              { prettySlug: { in: ['prov_1'] } },
              { provider: { id: { in: ['prov_1'] } } },
              { provider: { slug: { in: ['prov_1'] } } },
              { provider: { globalIdentifier: { in: ['prov_1'] } } }
            ]
          }
        ]
      },
      include: expect.objectContaining({ provider: expect.any(Object) })
    });
  });

  it('still updates and presents an existing provider', async () => {
    db.providerListing.findFirst.mockResolvedValue(listing);
    db.providerListing.findFirstOrThrow.mockResolvedValue({ ...listing, name: 'New' });

    let result = await adminProviderTelemetryService.updateProvider({
      providerId: 'prov_1',
      name: 'New'
    });

    expect(updateProvider).toHaveBeenCalledWith({
      provider: listing.provider,
      input: expect.objectContaining({ name: 'New' })
    });
    expect(result).toMatchObject({ id: 'prov_1', listing_id: 'pl_1', name: 'New' });
  });

  it('propagates database failures instead of misreporting them as missing providers', async () => {
    let failure = new Error('Database unavailable');
    db.providerListing.findFirst.mockRejectedValue(failure);

    await expect(
      adminProviderTelemetryService.getProvider({ providerId: 'prov_1' })
    ).rejects.toBe(failure);
  });
});
