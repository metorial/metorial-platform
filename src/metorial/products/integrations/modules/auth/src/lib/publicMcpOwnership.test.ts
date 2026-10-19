import { runWithPublicMcpAccess } from '@metorial-subspace/public-mcp-guard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  authCredentialsFindUnique: vi.fn(),
  authConfigUpdateMany: vi.fn(),
  configUpdateMany: vi.fn(),
  deploymentUpdateMany: vi.fn(),
  oauthSetupUpdateMany: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => {
  let db = {
    providerAuthCredentials: { findUnique: mocks.authCredentialsFindUnique },
    providerAuthConfig: { updateMany: mocks.authConfigUpdateMany },
    providerConfig: { updateMany: mocks.configUpdateMany },
    providerDeployment: { updateMany: mocks.deploymentUpdateMany },
    providerOAuthSetup: { updateMany: mocks.oauthSetupUpdateMany }
  };

  return {
    db,
    withTransaction: vi.fn(async (run: (db: unknown) => Promise<unknown>) => run(db))
  };
});

import { checkManagedCredentialsBlocked } from './checkManagedCredentialsBlocked';
import { stampPublicMcpOwnership } from './publicMcpOwnership';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkManagedCredentialsBlocked', () => {
  it('blocks export and import of public MCP owned auth configs', async () => {
    await expect(
      checkManagedCredentialsBlocked({
        ownerPublicMcpServerOid: 10n,
        authCredentialsOid: null
      } as any)
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: 'public_mcp_owned' }) });
  });

  it('blocks auth configs owned by a different server than the current scope', async () => {
    await runWithPublicMcpAccess({ publicMcpServerOid: 11n }, async () => {
      await expect(
        checkManagedCredentialsBlocked({
          ownerPublicMcpServerOid: 10n,
          authCredentialsOid: null
        } as any)
      ).rejects.toThrow();
    });
  });

  it('allows unowned tenant-created auth configs', async () => {
    mocks.authCredentialsFindUnique.mockResolvedValue({ origin: 'tenant_created' });

    await expect(
      checkManagedCredentialsBlocked({
        ownerPublicMcpServerOid: null,
        authCredentialsOid: 5n
      } as any)
    ).resolves.toBeUndefined();
  });
});

describe('stampPublicMcpOwnership', () => {
  it('does nothing for resources that are not public MCP owned', async () => {
    await stampPublicMcpOwnership({ ownerPublicMcpServerOid: null, authConfigOid: 1n });

    expect(mocks.authConfigUpdateMany).not.toHaveBeenCalled();
  });

  it('stamps ownership and detaches the resources from deployment defaults', async () => {
    await stampPublicMcpOwnership({
      ownerPublicMcpServerOid: 10n,
      authConfigOid: 1n,
      configOid: 2n,
      oauthSetupOid: 3n
    });

    expect(mocks.authConfigUpdateMany).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { ownerPublicMcpServerOid: 10n, source: 'public_mcp', isDefault: false }
    });
    expect(mocks.configUpdateMany).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { ownerPublicMcpServerOid: 10n, isDefault: false }
    });
    expect(mocks.deploymentUpdateMany).toHaveBeenCalledWith({
      where: { defaultAuthConfigOid: 1n },
      data: { defaultAuthConfigOid: null }
    });
    expect(mocks.deploymentUpdateMany).toHaveBeenCalledWith({
      where: { defaultConfigOid: 2n },
      data: { defaultConfigOid: null }
    });
    expect(mocks.oauthSetupUpdateMany).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: { ownerPublicMcpServerOid: 10n }
    });
  });
});
