import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    instance: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({
    encryptionSecret: 'test-secret'
  })
}));

vi.mock('@metorial/db', () => ({
  db
}));

import { __documentEditTokenTestUtils, documentEditTokenService } from './documentEditToken';

describe('documentEditTokenService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    db.instance.findFirst.mockReset();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  it('issues and verifies document-scoped edit tokens', async () => {
    let organization = { id: 'org_123' };
    let instance = { id: 'inst_123', organization, project: { id: 'proj_123' } };
    db.instance.findFirst.mockResolvedValue(instance);

    let issued = await documentEditTokenService.issueDocumentEditToken({
      documentId: 'doc_123',
      instanceId: 'inst_123',
      organizationId: 'org_123',
      accessActor: {
        name: 'Consumer',
        consumerId: 'consumer_123'
      }
    });

    let verified = await documentEditTokenService.verifyDocumentEditToken({
      token: issued.token,
      documentId: 'doc_123',
      instanceId: 'inst_123'
    });

    expect(issued.documentId).toBe('doc_123');
    expect(issued.expiresAt).toEqual(new Date(1_900_000));
    expect(db.instance.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'inst_123',
        organization: {
          id: 'org_123'
        }
      },
      include: {
        organization: true,
        project: true
      }
    });
    expect(verified.owner).toEqual({
      type: 'instance',
      organization,
      instance
    });
    expect(verified.accessActor).toEqual({
      name: 'Consumer',
      consumerId: 'consumer_123'
    });
  });

  it('rejects expired tokens', async () => {
    let token = await __documentEditTokenTestUtils.createToken({
      expiresAt: new Date(999_999)
    });

    await expect(
      documentEditTokenService.verifyDocumentEditToken({
        token,
        documentId: 'doc_123'
      })
    ).rejects.toThrow('Invalid document edit token');
    expect(db.instance.findFirst).not.toHaveBeenCalled();
  });

  it('rejects tokens with the wrong purpose', async () => {
    let token = await __documentEditTokenTestUtils.createToken({
      type: 'other'
    });

    await expect(
      documentEditTokenService.verifyDocumentEditToken({
        token,
        documentId: 'doc_123'
      })
    ).rejects.toThrow('Invalid document edit token');
    expect(db.instance.findFirst).not.toHaveBeenCalled();
  });

  it('rejects tokens for another document', async () => {
    let token = await __documentEditTokenTestUtils.createToken({
      claims: {
        documentId: 'doc_other'
      }
    });

    await expect(
      documentEditTokenService.verifyDocumentEditToken({
        token,
        documentId: 'doc_123'
      })
    ).rejects.toThrow('Invalid document edit token');
    expect(db.instance.findFirst).not.toHaveBeenCalled();
  });
});
