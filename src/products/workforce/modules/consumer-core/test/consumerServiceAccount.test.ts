import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  consumerSurfaceFindFirst: vi.fn(),
  portalFindFirst: vi.fn(),
  createServiceAccount: vi.fn(),
  archiveServiceAccount: vi.fn(),
  createServiceAccountConsumerProfile: vi.fn(),
  deleteConsumerProfile: vi.fn(),
  deleteServiceAccountConsumerProfile: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumerSurface: { findFirst: mocks.consumerSurfaceFindFirst },
    portal: { findFirst: mocks.portalFindFirst }
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@lowerdeck/id', () => ({ generatePlainId: vi.fn(() => 'plain123') }));

vi.mock('@metorial/module-machine-access', () => ({
  serviceAccountService: {
    createServiceAccount: mocks.createServiceAccount,
    archiveServiceAccount: mocks.archiveServiceAccount
  }
}));

vi.mock('../src/services/consumerProfile', () => ({
  consumerProfileService: {
    createServiceAccountConsumerProfile: mocks.createServiceAccountConsumerProfile,
    deleteConsumerProfile: mocks.deleteConsumerProfile,
    deleteServiceAccountConsumerProfile: mocks.deleteServiceAccountConsumerProfile
  }
}));

import { consumerServiceAccountService } from '../src/services/consumerServiceAccount';

let organization = { oid: 900n, id: 'org_1' } as any;
let portal = { oid: 33n, surfaceOid: 22n, organizationOid: 900n, status: 'active' } as any;
let surface = { oid: 22n, type: 'portal', status: 'active' };
let consumerProfile = { oid: 88n, id: 'cop_sa' };
let auditScope = { organizationOid: 900n } as any;
let input = { name: 'Deploy Bot', scopes: ['consumer#instance.profile:read'] };

describe('consumerServiceAccountService.createConsumerServiceAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumerSurfaceFindFirst.mockResolvedValue(surface);
    mocks.createServiceAccountConsumerProfile.mockResolvedValue(consumerProfile);
    mocks.createServiceAccount.mockResolvedValue({ id: 'sa_1' });
  });

  it('creates a dedicated profile on the portal and binds it to the service account', async () => {
    let serviceAccount = await consumerServiceAccountService.createConsumerServiceAccount({
      organization,
      portal,
      auditScope,
      input
    });

    expect(mocks.consumerSurfaceFindFirst).toHaveBeenCalledWith({
      where: { oid: 22n, organizationOid: 900n, type: 'portal', status: 'active' }
    });
    expect(mocks.createServiceAccountConsumerProfile).toHaveBeenCalledWith({
      surface,
      name: 'Deploy Bot',
      serviceAccountKey: 'plain123',
      auditScope
    });
    expect(mocks.createServiceAccount).toHaveBeenCalledWith({
      organization,
      auditScope,
      input,
      consumer: { portal, consumerProfile }
    });
    expect(serviceAccount).toEqual({ id: 'sa_1' });
  });

  it('rejects portals from another organization', async () => {
    await expect(
      consumerServiceAccountService.createConsumerServiceAccount({
        organization,
        portal: { ...portal, organizationOid: 1n },
        auditScope,
        input
      })
    ).rejects.toThrow();
    expect(mocks.createServiceAccountConsumerProfile).not.toHaveBeenCalled();
  });

  it('rejects portals without an active portal surface', async () => {
    mocks.consumerSurfaceFindFirst.mockResolvedValue(null);

    await expect(
      consumerServiceAccountService.createConsumerServiceAccount({
        organization,
        portal,
        auditScope,
        input
      })
    ).rejects.toThrow();
    expect(mocks.createServiceAccountConsumerProfile).not.toHaveBeenCalled();
  });

  it('removes the dedicated profile when the service account cannot be created', async () => {
    mocks.createServiceAccount.mockRejectedValue(new Error('payment required'));

    await expect(
      consumerServiceAccountService.createConsumerServiceAccount({
        organization,
        portal,
        auditScope,
        input
      })
    ).rejects.toThrow('payment required');
    expect(mocks.deleteConsumerProfile).toHaveBeenCalledWith({ consumerProfile, auditScope });
  });
});

describe('consumerServiceAccountService.archiveConsumerServiceAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archiveServiceAccount.mockResolvedValue({ id: 'sa_1', status: 'archived' });
  });

  it('archives the service account and deletes its dedicated profile', async () => {
    let serviceAccount = { oid: 5n, consumerProfileOid: 88n, oauthApplication: {} } as any;

    let result = await consumerServiceAccountService.archiveConsumerServiceAccount({
      serviceAccount,
      organization,
      auditScope
    });

    expect(mocks.archiveServiceAccount).toHaveBeenCalledWith({
      serviceAccount,
      organization,
      auditScope
    });
    expect(mocks.deleteServiceAccountConsumerProfile).toHaveBeenCalledWith({
      consumerProfile: { oid: 88n },
      auditScope
    });
    expect(result).toEqual({ id: 'sa_1', status: 'archived' });
  });

  it('skips profile cleanup for member service accounts', async () => {
    await consumerServiceAccountService.archiveConsumerServiceAccount({
      serviceAccount: { oid: 5n, consumerProfileOid: null, oauthApplication: {} } as any,
      organization,
      auditScope
    });

    expect(mocks.deleteServiceAccountConsumerProfile).not.toHaveBeenCalled();
  });
});

describe('consumerServiceAccountService.createServiceAccountForSubject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumerSurfaceFindFirst.mockResolvedValue(surface);
    mocks.portalFindFirst.mockResolvedValue(portal);
    mocks.createServiceAccountConsumerProfile.mockResolvedValue(consumerProfile);
    mocks.createServiceAccount.mockResolvedValue({ id: 'sa_1' });
  });

  it('creates a member service account when no subject is given', async () => {
    await consumerServiceAccountService.createServiceAccountForSubject({
      organization,
      auditScope,
      input: { name: 'Deploy Bot', scopes: ['organization:read'] }
    });

    expect(mocks.portalFindFirst).not.toHaveBeenCalled();
    expect(mocks.createServiceAccount).toHaveBeenCalledWith({
      organization,
      auditScope,
      input: { name: 'Deploy Bot', scopes: ['organization:read'] }
    });
  });

  it('rejects a portal for member service accounts', async () => {
    await expect(
      consumerServiceAccountService.createServiceAccountForSubject({
        organization,
        auditScope,
        input: { ...input, subjectType: 'organization_member', portalId: 'ptl_1' }
      })
    ).rejects.toThrow();
    expect(mocks.createServiceAccount).not.toHaveBeenCalled();
  });

  it('requires a portal for consumer service accounts', async () => {
    await expect(
      consumerServiceAccountService.createServiceAccountForSubject({
        organization,
        auditScope,
        input: { ...input, subjectType: 'consumer' }
      })
    ).rejects.toThrow();
    expect(mocks.createServiceAccount).not.toHaveBeenCalled();
  });

  it('resolves the portal within the organization for consumer service accounts', async () => {
    await consumerServiceAccountService.createServiceAccountForSubject({
      organization,
      auditScope,
      input: { ...input, subjectType: 'consumer', portalId: 'ptl_1' }
    });

    expect(mocks.portalFindFirst).toHaveBeenCalledWith({
      where: { id: 'ptl_1', organizationOid: 900n }
    });
    expect(mocks.createServiceAccount).toHaveBeenCalledWith({
      organization,
      auditScope,
      input,
      consumer: { portal, consumerProfile }
    });
  });

  it('rejects unknown portals', async () => {
    mocks.portalFindFirst.mockResolvedValue(null);

    await expect(
      consumerServiceAccountService.createServiceAccountForSubject({
        organization,
        auditScope,
        input: { ...input, subjectType: 'consumer', portalId: 'ptl_missing' }
      })
    ).rejects.toThrow();
    expect(mocks.createServiceAccountConsumerProfile).not.toHaveBeenCalled();
  });
});

describe('consumerServiceAccountService.archiveServiceAccountForSubject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archiveServiceAccount.mockResolvedValue({ id: 'sa_1', status: 'archived' });
  });

  it('cleans up the dedicated profile for consumer service accounts', async () => {
    await consumerServiceAccountService.archiveServiceAccountForSubject({
      serviceAccount: {
        oid: 5n,
        subjectType: 'consumer',
        consumerProfileOid: 88n,
        oauthApplication: {}
      } as any,
      organization,
      auditScope
    });

    expect(mocks.deleteServiceAccountConsumerProfile).toHaveBeenCalledWith({
      consumerProfile: { oid: 88n },
      auditScope
    });
  });

  it('only archives member service accounts', async () => {
    await consumerServiceAccountService.archiveServiceAccountForSubject({
      serviceAccount: {
        oid: 5n,
        subjectType: 'organization_member',
        consumerProfileOid: null,
        oauthApplication: {}
      } as any,
      organization,
      auditScope
    });

    expect(mocks.archiveServiceAccount).toHaveBeenCalled();
    expect(mocks.deleteServiceAccountConsumerProfile).not.toHaveBeenCalled();
  });
});
