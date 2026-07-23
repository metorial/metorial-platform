import { describe, expect, it } from 'vitest';
import { __documentEditTokenTestUtils, documentEditTokenService } from './documentEditToken';

describe('document edit tokens', () => {
  it('preserves access tags through token signing', async () => {
    let issued = await documentEditTokenService.issueDocumentEditToken({
      documentId: 'doc_123',
      instanceId: 'inst_123',
      organizationId: 'org_123',
      accessTags: [11n, { oid: 22n }, { accessTagOid: 33n }]
    });

    let claims = await __documentEditTokenTestUtils.readTokenClaims(issued.token);

    expect(claims.accessTagOids).toEqual(['11', '22', '33']);
    expect(__documentEditTokenTestUtils.deserializeAccessTags(claims.accessTagOids)).toEqual([
      11n,
      22n,
      33n
    ]);
  });

  it('rejects expired tokens', async () => {
    let token = await __documentEditTokenTestUtils.createToken({
      expiresAt: new Date(Date.now() - 1_000)
    });

    await expect(
      documentEditTokenService.verifyDocumentEditToken({
        token,
        documentId: 'doc_123',
        instanceId: 'inst_123'
      })
    ).rejects.toThrow();
  });

  it('rejects tokens for another document or instance', async () => {
    let token = await __documentEditTokenTestUtils.createToken({});

    await expect(
      documentEditTokenService.verifyDocumentEditToken({
        token,
        documentId: 'doc_other',
        instanceId: 'inst_123'
      })
    ).rejects.toThrow();
    await expect(
      documentEditTokenService.verifyDocumentEditToken({
        token,
        documentId: 'doc_123',
        instanceId: 'inst_other'
      })
    ).rejects.toThrow();
  });
});
