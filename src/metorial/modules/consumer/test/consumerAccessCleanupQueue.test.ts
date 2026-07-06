import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, processors, createQueueMock, listingDeleteMock, accessDeleteMock } = vi.hoisted(
  () => {
    let processors = new Map<string, (data: any) => Promise<void>>();
    let db = {
      organization: {
        findUnique: vi.fn()
      },
      providerTemplate: {
        findUnique: vi.fn()
      },
      magicMcpServer: {
        findUnique: vi.fn()
      },
      consumerAccessListing: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      },
      consumerAccess: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      }
    };

    return {
      db,
      processors,
      createQueueMock: vi.fn((config: { name: string }) => ({
        add: vi.fn(),
        addMany: vi.fn(),
        addManyWithOps: vi.fn(),
        process: vi.fn((handler: (data: any) => Promise<void>) => {
          processors.set(config.name, handler);
          return { name: config.name, handler };
        })
      })),
      listingDeleteMock: vi.fn(),
      accessDeleteMock: vi.fn()
    };
  }
);

vi.mock('@metorial/queue', () => ({
  createQueue: createQueueMock
}));

vi.mock('@metorial/db', () => ({
  db
}));

vi.mock('../src/services/consumerAccess/consumerAccessListing', () => ({
  consumerAccessListingService: {
    delete: listingDeleteMock
  }
}));

vi.mock('../src/services/consumerAccess/consumerAccess', () => ({
  consumerAccessService: {
    deleteConsumerAccess: accessDeleteMock
  }
}));

import {
  consumerAccessDeleteQueue,
  consumerAccessListingDeleteQueue,
  consumerTargetAccessCleanupManyQueue
} from '../src/queues/lifecycle/consumerAccessCleanup';

describe('consumer access cleanup queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fans target cleanup into listing and access single-delete jobs', async () => {
    db.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    db.providerTemplate.findUnique.mockResolvedValue({ oid: 10n });
    db.consumerAccessListing.findMany.mockResolvedValue([{ id: 'listing-1' }]);

    await processors.get('cons/lc/access/cleanupTargetMany')!({
      organizationId: 'org-1',
      providerTemplateId: 'provider-template-1'
    });

    expect(consumerAccessListingDeleteQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { organizationId: 'org-1', consumerAccessListingId: 'listing-1' },
        opts: { id: 'delete-listing-org-1-listing-1' }
      }
    ]);
    expect(consumerTargetAccessCleanupManyQueue.add).toHaveBeenCalledWith({
      organizationId: 'org-1',
      providerTemplateId: 'provider-template-1',
      listingCursor: 'listing-1'
    });
    expect(consumerAccessDeleteQueue.addManyWithOps).not.toHaveBeenCalled();
  });

  it('only separately deletes unlisted accesses after listings are exhausted', async () => {
    db.organization.findUnique.mockResolvedValue({ id: 'org-1' });
    db.providerTemplate.findUnique.mockResolvedValue({ oid: 10n });
    db.consumerAccessListing.findMany.mockResolvedValue([]);
    db.consumerAccess.findMany.mockResolvedValue([{ id: 'access-1' }]);

    await processors.get('cons/lc/access/cleanupTargetMany')!({
      organizationId: 'org-1',
      providerTemplateId: 'provider-template-1'
    });

    expect(db.consumerAccess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerTemplateOid: 10n,
          listingOid: null
        })
      })
    );
    expect(consumerAccessDeleteQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { organizationId: 'org-1', consumerAccessId: 'access-1' },
        opts: { id: 'delete-access-org-1-access-1' }
      }
    ]);
  });

  it('deletes one listing through the listing service', async () => {
    let organization = { id: 'org-1' };
    let listing = { id: 'listing-1' };
    db.organization.findUnique.mockResolvedValue(organization);
    db.consumerAccessListing.findUnique.mockResolvedValue(listing);

    await processors.get('cons/lc/access/deleteListing')!({
      organizationId: 'org-1',
      consumerAccessListingId: 'listing-1'
    });

    expect(listingDeleteMock).toHaveBeenCalledWith({
      organization,
      consumerAccessListing: listing
    });
  });

  it('deletes one access through the access service', async () => {
    let organization = { id: 'org-1' };
    let access = { id: 'access-1' };
    db.organization.findUnique.mockResolvedValue(organization);
    db.consumerAccess.findUnique.mockResolvedValue(access);

    await processors.get('cons/lc/access/deleteAccess')!({
      organizationId: 'org-1',
      consumerAccessId: 'access-1'
    });

    expect(accessDeleteMock).toHaveBeenCalledWith({
      organization,
      consumerAccess: access
    });
  });
});
