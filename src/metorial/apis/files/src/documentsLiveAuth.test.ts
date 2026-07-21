import { describe, expect, it, vi } from 'vitest';
import { resolveDocumentsLiveTarget } from './documentsLiveAuth';

let verifyDocumentEditToken = vi.hoisted(() => vi.fn());

vi.mock('@metorial/cargo-module-doc', () => ({
  documentEditTokenService: {
    verifyDocumentEditToken
  }
}));
vi.mock('./uploadAccess', () => ({
  resolveUploadTarget: vi.fn()
}));

describe('documents live edit-token auth', () => {
  it('restores consumer access tags for live document authorization', async () => {
    verifyDocumentEditToken.mockReset();
    let owner = {
      type: 'instance',
      organization: { id: 'org_123' },
      instance: { id: 'inst_123' }
    } as any;
    verifyDocumentEditToken.mockResolvedValue({
      owner,
      accessTags: [101n, 202n],
      accessActor: {
        identifier: 'mte-con-con_123',
        name: 'Portal consumer',
        consumerOid: 303n
      }
    });
    let authenticateRequest = vi.fn();

    let target = await resolveDocumentsLiveTarget({
      req: new Request('http://localhost/documents-live'),
      url: new URL('http://localhost/documents-live'),
      documentId: 'doc_123',
      instanceId: 'inst_123',
      editToken: 'document_edit_token',
      authenticateRequest
    });

    expect(authenticateRequest).not.toHaveBeenCalled();
    expect(target).toEqual({
      owner,
      canWrite: true,
      cargoAccess: {
        accessTags: [101n, 202n],
        accessActor: {
          identifier: 'mte-con-con_123',
          name: 'Portal consumer',
          consumerOid: 303n
        },
        defaultPermissions: undefined,
        overridePermissions: undefined
      }
    });
  });
});
