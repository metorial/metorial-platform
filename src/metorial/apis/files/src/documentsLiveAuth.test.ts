import { beforeEach, describe, expect, it, vi } from 'vitest';

let { verifyDocumentEditTokenMock, resolveUploadTargetMock } = vi.hoisted(() => ({
  verifyDocumentEditTokenMock: vi.fn(),
  resolveUploadTargetMock: vi.fn()
}));

vi.mock('@metorial/module-file', () => ({
  documentEditTokenService: {
    verifyDocumentEditToken: verifyDocumentEditTokenMock
  }
}));

vi.mock('./uploadAccess', () => ({
  resolveUploadTarget: resolveUploadTargetMock
}));

import { resolveDocumentsLiveTarget } from './documentsLiveAuth';

describe('resolveDocumentsLiveTarget', () => {
  beforeEach(() => {
    verifyDocumentEditTokenMock.mockReset();
    resolveUploadTargetMock.mockReset();
  });

  it('uses edit tokens without calling normal request authentication', async () => {
    let authenticateRequest = vi.fn();
    let owner = {
      type: 'instance',
      organization: { id: 'org_123' },
      instance: { id: 'inst_123' }
    };
    verifyDocumentEditTokenMock.mockResolvedValue({
      owner,
      accessActor: {
        name: 'Consumer',
        consumerId: 'consumer_123'
      }
    });

    let target = await resolveDocumentsLiveTarget({
      req: new Request('https://api.example.test/documents-live'),
      url: new URL('https://api.example.test/documents-live?edit_token=tok_123'),
      documentId: 'doc_123',
      instanceId: 'inst_123',
      editToken: 'tok_123',
      authenticateRequest
    });

    expect(verifyDocumentEditTokenMock).toHaveBeenCalledWith({
      token: 'tok_123',
      documentId: 'doc_123',
      instanceId: 'inst_123'
    });
    expect(authenticateRequest).not.toHaveBeenCalled();
    expect(resolveUploadTargetMock).not.toHaveBeenCalled();
    expect(target).toEqual({
      owner,
      cargoAccess: {
        accessActor: {
          name: 'Consumer',
          consumerId: 'consumer_123'
        },
        defaultPermissions: undefined,
        overridePermissions: undefined
      }
    });
  });

  it('uses normal request authentication when no edit token is present', async () => {
    let auth = { type: 'machine' };
    let target = { owner: { type: 'instance' }, cargoAccess: {} };
    let authenticateRequest = vi.fn().mockResolvedValue({ auth });
    resolveUploadTargetMock.mockResolvedValue(target);
    let req = new Request('https://api.example.test/documents-live');
    let url = new URL('https://api.example.test/documents-live');

    await expect(
      resolveDocumentsLiveTarget({
        req,
        url,
        documentId: 'doc_123',
        instanceId: 'inst_123',
        organizationId: 'org_123',
        authenticateRequest
      })
    ).resolves.toBe(target);

    expect(verifyDocumentEditTokenMock).not.toHaveBeenCalled();
    expect(authenticateRequest).toHaveBeenCalledWith(req, url);
    expect(resolveUploadTargetMock).toHaveBeenCalledWith({
      auth,
      instanceId: 'inst_123',
      organizationId: 'org_123'
    });
  });
});
