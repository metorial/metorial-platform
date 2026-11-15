import { describe, expect, it, vi } from 'vitest';
import { __documentEditTokenTestUtils, documentEditTokenService } from './documentEditToken';

let findInstance = vi.hoisted(() => vi.fn());

vi.mock('@metorial/config', () => ({
  getConfig: () => ({ encryptionSecret: 'test-secret' })
}));
vi.mock('@metorial/db', () => ({
  db: {
    instance: {
      findFirst: findInstance
    }
  }
}));

describe('document edit tokens', () => {
  it('preserves access tags through token signing', async () => {
    let issued = await documentEditTokenService.issueDocumentEditToken({
      documentId: 'doc_123',
      instanceId: 'inst_123',
      organizationId: 'org_123',
      accessTags: [11n, { oid: 22n }, { accessTagOid: 33n }],
      accessActor: {
        name: 'Test actor',
        resourceActorId: 'rac_123'
      },
      permissions: ['content_read', 'content_write']
    });

    let claims = await __documentEditTokenTestUtils.readTokenClaims(issued.token);

    expect(claims.accessTagOids).toEqual(['11', '22', '33']);
    expect(__documentEditTokenTestUtils.deserializeAccessTags(claims.accessTagOids)).toEqual([
      11n,
      22n,
      33n
    ]);
    expect(issued.expiresAt.getTime() - Date.now()).toBeGreaterThan(4 * 60 * 1000);
    expect(issued.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
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

  it('rejects legacy tokens without explicit capabilities', async () => {
    let token = await __documentEditTokenTestUtils.createToken({
      claims: {
        version: undefined,
        permissions: undefined
      }
    });

    await expect(
      documentEditTokenService.verifyDocumentEditToken({
        token,
        documentId: 'doc_123',
        instanceId: 'inst_123'
      })
    ).rejects.toThrow();
  });

  it('rejects tokens without read access or with ambiguous actors', async () => {
    let withoutRead = await __documentEditTokenTestUtils.createToken({
      claims: { permissions: ['content_write'] }
    });
    let ambiguousActor = await __documentEditTokenTestUtils.createToken({
      claims: {
        accessActor: {
          name: 'Ambiguous actor',
          resourceActorId: 'rac_123',
          consumerProfileOid: '123'
        }
      }
    });

    for (let token of [withoutRead, ambiguousActor]) {
      await expect(
        documentEditTokenService.verifyDocumentEditToken({
          token,
          documentId: 'doc_123',
          instanceId: 'inst_123'
        })
      ).rejects.toThrow();
    }
  });

  it('returns the signed capabilities and expiry for a valid token', async () => {
    findInstance.mockResolvedValue({
      id: 'inst_123',
      organization: { id: 'org_123' }
    });
    let token = await __documentEditTokenTestUtils.createToken({
      claims: { permissions: ['content_read'] }
    });

    let verified = await documentEditTokenService.verifyDocumentEditToken({
      token,
      documentId: 'doc_123',
      instanceId: 'inst_123',
      organizationId: 'org_123'
    });

    expect(verified.permissions).toEqual(['content_read']);
    expect(verified.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects malformed and excessively long-lived tokens', async () => {
    let overlong = await __documentEditTokenTestUtils.createToken({
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    for (let token of ['not-a-token', overlong]) {
      await expect(
        documentEditTokenService.verifyDocumentEditToken({
          token,
          documentId: 'doc_123',
          instanceId: 'inst_123'
        })
      ).rejects.toThrow();
    }
  });
});
