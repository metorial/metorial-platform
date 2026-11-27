import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  findSecret: vi.fn(),
  decrypt: vi.fn(),
  updateSecret: vi.fn(),
  captureException: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    slateAuthConfig: { findMany: mocks.findMany, updateMany: mocks.updateMany },
    secret: { findUnique: mocks.findSecret }
  }
}));

vi.mock('./secret', () => ({
  secretService: {
    DANGEROUSLY_decryptSecret: mocks.decrypt,
    DANGEROUSLY_updateSecret: mocks.updateSecret
  }
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: mocks.captureException })
}));

let { syncSharedOAuthTokens } = await import('./sharedOAuthTokenSync');

let source = {
  authConfigOid: 1n,
  authConfigId: 'shiac_source',
  slateOid: 10n,
  authMethodKey: 'oauth',
  clientId: 'client-1',
  profileUid: 'UBOT'
};

let previousOutput = {
  token: 'xoxb-old',
  refreshToken: 'xoxe-old',
  expiresAt: '2026-10-07T00:00:00.000Z',
  userId: 'U_SOURCE_INSTALLER'
};
let newOutput = {
  ...previousOutput,
  token: 'xoxb-new',
  refreshToken: 'xoxe-new',
  expiresAt: '2026-10-07T12:00:00.000Z'
};

let sibling = (id: string, oid: bigint) => ({
  id,
  oid,
  secret: { oid: oid * 100n, status: 'active' },
  tenant: { oid: oid * 1000n }
});

describe('syncSharedOAuthTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSecret.mockImplementation(async (d: { where: { oid: bigint } }) => ({
      oid: d.where.oid,
      status: 'active'
    }));
  });

  it('copies rotated tokens to a sibling holding the same refresh token', async () => {
    mocks.findMany.mockResolvedValue([sibling('shiac_sibling', 2n)]);
    mocks.decrypt.mockResolvedValue({
      input: {},
      output: { ...previousOutput, userId: 'U_SIBLING_INSTALLER' }
    });

    let result = await syncSharedOAuthTokens({ source, previousOutput, newOutput });

    expect(result).toEqual({ synced: 1 });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          oid: { not: 1n },
          type: 'oauth_automated',
          errorCode: null,
          slateOid: 10n,
          profileUid: 'UBOT',
          authMethod: { key: 'oauth' },
          oauthCredentials: { clientId: 'client-1' },
          secret: { status: 'active' }
        }
      })
    );
    expect(mocks.decrypt).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: { oid: 2000n },
        note: 'oauth-sibling-sync cfg:shiac_sibling'
      })
    );
    expect(mocks.updateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: { oid: 2000n },
        secretData: {
          input: {},
          output: {
            token: 'xoxb-new',
            refreshToken: 'xoxe-new',
            expiresAt: '2026-10-07T12:00:00.000Z',
            userId: 'U_SIBLING_INSTALLER'
          }
        }
      })
    );
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { tokenExpiresAt: new Date('2026-10-07T12:00:00.000Z') }
    });
  });

  it('leaves siblings with a different refresh token untouched', async () => {
    mocks.findMany.mockResolvedValue([sibling('shiac_other', 3n)]);
    mocks.decrypt.mockResolvedValue({ output: { ...previousOutput, refreshToken: 'xoxe-x' } });

    let result = await syncSharedOAuthTokens({ source, previousOutput, newOutput });

    expect(result).toEqual({ synced: 0 });
    expect(mocks.updateSecret).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('keeps going when one sibling fails', async () => {
    mocks.findMany.mockResolvedValue([sibling('shiac_broken', 5n), sibling('shiac_ok', 6n)]);
    mocks.decrypt
      .mockRejectedValueOnce(new Error('nebula down'))
      .mockResolvedValueOnce({ output: previousOutput });

    let result = await syncSharedOAuthTokens({ source, previousOutput, newOutput });

    expect(result).toEqual({ synced: 1 });
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 6n } })
    );
  });

  it('never writes tokens into a secret deleted after the query', async () => {
    mocks.findMany.mockResolvedValue([sibling('shiac_deleted', 7n)]);
    mocks.decrypt.mockResolvedValue({ output: previousOutput });
    mocks.findSecret.mockResolvedValue({ oid: 700n, status: 'deleted' });

    let result = await syncSharedOAuthTokens({ source, previousOutput, newOutput });

    expect(result).toEqual({ synced: 0 });
    expect(mocks.updateSecret).not.toHaveBeenCalled();
  });

  it('syncs many siblings in bounded batches', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => sibling(`shiac_${i}`, BigInt(i + 10)))
    );
    mocks.decrypt.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 1));
      inFlight--;
      return { output: previousOutput };
    });

    let result = await syncSharedOAuthTokens({ source, previousOutput, newOutput });

    expect(result).toEqual({ synced: 12 });
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it.each([
    {
      label: 'there is no previous refresh token',
      input: { source, previousOutput: { token: 'a' }, newOutput: { token: 'b' } }
    },
    {
      label: 'the config has no profile',
      input: { source: { ...source, profileUid: null }, previousOutput, newOutput }
    },
    {
      label: 'the refresh token did not rotate',
      input: { source, previousOutput, newOutput: { ...previousOutput, token: 'xoxb-new' } }
    }
  ])('does nothing when $label', async ({ input }) => {
    expect(await syncSharedOAuthTokens(input)).toEqual({ synced: 0 });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });
});
