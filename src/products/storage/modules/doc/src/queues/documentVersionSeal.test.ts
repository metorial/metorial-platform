import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, fire, queueAdd } = vi.hoisted(() => ({
  db: {
    documentVersion: {
      findUnique: vi.fn()
    }
  },
  fire: vi.fn(),
  queueAdd: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db }));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(() => ({
    add: queueAdd,
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors)
}));

import { enqueueDocumentVersionSeal, sealDocumentVersion } from './documentVersionSeal';

let editor = (overrides: Record<string, unknown> = {}) => ({
  ip: '10.0.0.1',
  ua: 'Firefox',
  resourceActor: {
    id: 'rac_1',
    organizationActorOid: 7n,
    organizationActor: { id: 'oac_1' },
    consumerProfile: null
  },
  ...overrides
});

let version = (editors: unknown[]) => ({
  id: 'dver_1',
  versionNumber: 4,
  listEditedAt: new Date('2026-08-20T10:00:00.000Z'),
  createdAt: new Date('2026-08-20T08:00:00.000Z'),
  instanceOid: 3n,
  previousVersion: { id: 'dver_0' },
  content: { content: 'hello world' },
  document: {
    id: 'doc_1',
    title: 'Design notes',
    instance: { oid: 3n, organizationOid: 1n }
  },
  documentVersionEditors: editors
});

describe('enqueueDocumentVersionSeal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keys the job by version so a version is only sealed once', async () => {
    await enqueueDocumentVersionSeal({ documentVersionId: 'dver_1' });

    expect(queueAdd).toHaveBeenCalledWith(
      { documentVersionId: 'dver_1' },
      { id: 'doc-version-seal-dver_1' }
    );
  });
});

describe('sealDocumentVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fire.mockResolvedValue(undefined);
  });

  it('loads the version, its document and its editors in one query', async () => {
    db.documentVersion.findUnique.mockResolvedValue(version([editor()]));

    await sealDocumentVersion({ documentVersionId: 'dver_1' });

    expect(db.documentVersion.findUnique).toHaveBeenCalledTimes(1);
    expect(db.documentVersion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'dver_1' } })
    );
  });

  it('emits one editor entry per participant, linking the sealed version', async () => {
    db.documentVersion.findUnique.mockResolvedValue(
      version([
        editor(),
        editor({
          ip: '10.0.0.2',
          ua: 'Safari',
          resourceActor: {
            id: 'rac_2',
            organizationActorOid: null,
            organizationActor: null,
            consumerProfile: { id: 'cpf_1' }
          }
        })
      ])
    );

    let result = await sealDocumentVersion({ documentVersionId: 'dver_1' });

    expect(result).toEqual({ editorCount: 2 });
    expect(fire).toHaveBeenCalledTimes(1);

    let [event, payload] = fire.mock.calls[0]!;
    expect(event).toBe('document.version.sealed:after');
    expect(payload.document).toEqual({ id: 'doc_1', title: 'Design notes' });
    expect(payload.version).toEqual({
      id: 'dver_1',
      versionNumber: 4,
      byteSize: 11,
      editedAt: new Date('2026-08-20T10:00:00.000Z')
    });
    expect(payload.previousVersionId).toBe('dver_0');
    expect(payload.editors).toHaveLength(2);
  });

  it('attributes an organization member through their organization actor', async () => {
    db.documentVersion.findUnique.mockResolvedValue(version([editor()]));

    await sealDocumentVersion({ documentVersionId: 'dver_1' });

    let [, payload] = fire.mock.calls[0]!;
    expect(payload.editors[0].auditScope).toEqual({
      organizationOid: 1n,
      instanceOid: 3n,
      organizationActorOid: 7n,
      actor: { type: 'org_actor', id: 'oac_1' },
      context: { ip: '10.0.0.1', ua: 'Firefox' }
    });
  });

  it('attributes a consumer through their consumer profile', async () => {
    db.documentVersion.findUnique.mockResolvedValue(
      version([
        editor({
          resourceActor: {
            id: 'rac_2',
            organizationActorOid: null,
            organizationActor: null,
            consumerProfile: { id: 'cpf_1' }
          }
        })
      ])
    );

    await sealDocumentVersion({ documentVersionId: 'dver_1' });

    let [, payload] = fire.mock.calls[0]!;
    expect(payload.editors[0].auditScope).toMatchObject({
      organizationActorOid: undefined,
      actor: { type: 'consumer_profile', id: 'cpf_1' }
    });
  });

  it('falls back to the resource actor for an agent with no person behind it', async () => {
    db.documentVersion.findUnique.mockResolvedValue(
      version([
        editor({
          ip: null,
          ua: null,
          resourceActor: {
            id: 'rac_agent',
            organizationActorOid: null,
            organizationActor: null,
            consumerProfile: null
          }
        })
      ])
    );

    await sealDocumentVersion({ documentVersionId: 'dver_1' });

    let [, payload] = fire.mock.calls[0]!;
    expect(payload.editors[0].auditScope).toMatchObject({
      actor: { type: 'resource_actor', id: 'rac_agent' },
      context: { ip: '', ua: null }
    });
  });

  it('dates the events from when the document was edited, not when it was sealed', async () => {
    db.documentVersion.findUnique.mockResolvedValue({
      ...version([editor()]),
      listEditedAt: null
    });

    await sealDocumentVersion({ documentVersionId: 'dver_1' });

    let [, payload] = fire.mock.calls[0]!;
    expect(payload.version.editedAt).toEqual(new Date('2026-08-20T08:00:00.000Z'));
  });

  it('records nothing for a version nobody edited', async () => {
    db.documentVersion.findUnique.mockResolvedValue(version([]));

    await expect(sealDocumentVersion({ documentVersionId: 'dver_1' })).resolves.toBeNull();
    expect(fire).not.toHaveBeenCalled();
  });

  it('records nothing for a version that has since been pruned', async () => {
    db.documentVersion.findUnique.mockResolvedValue(null);

    await expect(sealDocumentVersion({ documentVersionId: 'dver_1' })).resolves.toBeNull();
    expect(fire).not.toHaveBeenCalled();
  });
});
