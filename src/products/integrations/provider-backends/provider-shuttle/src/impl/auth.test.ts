import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    shuttleServer: { findFirstOrThrow: vi.fn() },
    shuttleOAuthCredentials: { create: vi.fn() }
  },
  getTenantForShuttle: vi.fn(),
  createCredentials: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  snowflake: { nextId: () => 1n }
}));

vi.mock('../client', () => ({
  getTenantForShuttle: mocks.getTenantForShuttle,
  shuttle: {
    serverOAuthCredentials: { create: mocks.createCredentials }
  }
}));

import { ProviderAuth } from './auth';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.shuttleServer.findFirstOrThrow.mockResolvedValue({
    oid: 20n,
    id: 'ser_1'
  });
  mocks.getTenantForShuttle.mockResolvedValue({ id: 'ten_1' });
  mocks.createCredentials.mockResolvedValue({ id: 'soc_1' });
  mocks.db.shuttleOAuthCredentials.create.mockResolvedValue({
    oid: 30n,
    id: 'soc_1'
  });
});

describe('createProviderAuthCredentials', () => {
  it('passes the default-reuse hint through to Shuttle', async () => {
    await new ProviderAuth({ backend: {} as any }).createProviderAuthCredentials({
      tenant: { oid: 1n, projectOid: 2n } as any,
      provider: { defaultVariant: { shuttleServerOid: 20n } } as any,
      reuseDefaultCredentials: true,
      input: { type: 'auto_registration' }
    });

    expect(mocks.createCredentials).toHaveBeenCalledWith({
      tenantId: 'ten_1',
      serverId: 'ser_1',
      reuseDefault: true
    });
  });
});
