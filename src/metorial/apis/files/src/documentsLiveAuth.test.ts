import { describe, expect, it, vi } from 'vitest';
import { resolveDocumentsLiveToken } from './documentsLiveAuth';

let verifyDocumentEditToken = vi.hoisted(() => vi.fn());
let getDocumentById = vi.hoisted(() => vi.fn());
let getDocumentPermissions = vi.hoisted(() => vi.fn());
let resolveCargoAccess = vi.hoisted(() => vi.fn());

vi.mock('@metorial/cargo-module-doc', () => ({
  documentEditTokenService: { verifyDocumentEditToken },
  documentService: { getDocumentById, getDocumentPermissions }
}));
vi.mock('@metorial/cargo-module-file', () => ({ resolveCargoAccess }));
vi.mock('@metorial/db', () => ({
  db: {
    consumerProfile: {
      findFirst: vi.fn()
    }
  }
}));
vi.mock('@metorial/module-access', () => ({
  createResourceAuthorization: vi.fn()
}));

describe('documents live token authorization', () => {
  it('intersects signed capabilities with current document permissions', async () => {
    let owner = {
      type: 'instance',
      organization: { id: 'org_123' },
      instance: { id: 'inst_123', oid: 1n }
    } as any;
    let authorization = { type: 'privileged', resourceActor: { id: 'rac_123' } };
    verifyDocumentEditToken.mockResolvedValue({
      owner,
      documentId: 'doc_123',
      instanceId: 'inst_123',
      organizationId: 'org_123',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
      permissions: ['content_read', 'content_write'],
      accessTags: [],
      accessActor: { name: 'Member', resourceActorId: 'rac_123' },
      defaultPermissions: [],
      overridePermissions: false
    });
    resolveCargoAccess.mockResolvedValue({
      actor: { id: 'rac_123', consumerProfileOid: null },
      actorId: 'rac_123',
      authorization,
      scope: { project: { oid: 3n }, instance: { oid: 1n } }
    });
    getDocumentById.mockResolvedValue({ id: 'doc_123', isReadOnly: false });
    getDocumentPermissions.mockResolvedValue({
      hasFullAccess: false,
      permissions: ['content_read']
    });

    let target = await resolveDocumentsLiveToken({
      editToken: 'document_edit_token',
      documentId: 'doc_123',
      instanceId: 'inst_123'
    });

    expect(target.permissions).toEqual(['content_read']);
    expect(target.actorId).toBe('rac_123');
    expect(target.authorization).toBe(authorization);
  });

  it('rejects a token when current read access has been removed', async () => {
    getDocumentPermissions.mockResolvedValue({
      hasFullAccess: false,
      permissions: []
    });

    await expect(
      resolveDocumentsLiveToken({
        editToken: 'document_edit_token',
        documentId: 'doc_123',
        instanceId: 'inst_123'
      })
    ).rejects.toThrow('does not grant read access');
  });
});
