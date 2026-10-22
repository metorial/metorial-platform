import { beforeEach, describe, expect, it, mock } from 'bun:test';

process.env.DATABASE_URL ??= 'postgresql://localhost/test';
process.env.INTEGRATIONS_API_URL ??= 'https://integrations.example.com';
process.env.SLATE_ATTACHMENT_SIGNING_SECRET ??= 'test-oauth-callback-secret';

let findMany = mock(async ({ where }: any) =>
  where.providerOid.in.map((providerOid: bigint) => ({
    oid: providerOid + 1000n,
    tenantOid: where.tenantOid,
    providerOid,
    providerTypeOid: 1n,
    slug: `stored-${providerOid}`
  }))
);

let findUnique = mock(async () => null);

mock.module('../db', () => ({
  db: { tenantOAuthCallbackUrl: { findMany, findUnique } }
}));

mock.module('../id', () => ({ getId: () => ({ id: 'test' }) }));

let { getOAuthCallbackUrl } = await import('./getOAuthCallbackUrl');

let providerType = { oid: 1n, shortKey: 'pt' } as any;

let tenantFor = (oid: bigint) => ({ oid, urlKey: `tenant${oid}`, projectOid: 1n }) as any;

let providerFor = (oid: bigint) => ({ oid, tag: `provider${oid}` }) as any;

describe('getOAuthCallbackUrl', () => {
  beforeEach(() => {
    findMany.mockClear();
    findUnique.mockClear();
  });

  it('coalesces concurrent lookups for a tenant into a single query', async () => {
    let tenant = tenantFor(1n);
    let providerOids = [10n, 11n, 12n, 13n, 14n];

    let urls = await Promise.all(
      providerOids.map(oid => getOAuthCallbackUrl(providerType, providerFor(oid), tenant))
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findUnique).not.toHaveBeenCalled();
    expect(urls.map(url => new URL(url).pathname)).toEqual(
      providerOids.map(oid => `/oauth-callback/stored-${oid}`)
    );
  });

  it('keeps lookups for different tenants in separate queries', async () => {
    await Promise.all([
      getOAuthCallbackUrl(providerType, providerFor(10n), tenantFor(1n)),
      getOAuthCallbackUrl(providerType, providerFor(10n), tenantFor(2n))
    ]);

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls.map(([args]: any) => args.where.tenantOid).sort()).toEqual([
      1n,
      2n
    ]);
  });
});
