import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, withTransaction, getId } = vi.hoisted(() => {
  let db = {
    documentVersion: {
      aggregate: vi.fn(),
      create: vi.fn()
    },
    document: {
      update: vi.fn()
    }
  };

  return {
    db,
    withTransaction: vi.fn(async (fn: any) => await fn(db)),
    getId: vi.fn(() => ({
      oid: 100n,
      id: 'dver_generated'
    }))
  };
});

vi.mock('@metorial/db', () => ({
  withTransaction
}));

vi.mock('@metorial/cargo-config/id', () => ({
  getId
}));

import { internalDocumentVersioningService } from './documentVersioning';

let createVersion = async (maxVersionNumber: number) =>
  await internalDocumentVersioningService.createVersion({
    project: { oid: 5n },
    instance: { oid: 6n },
    document: {
      oid: 3n,
      maxVersionNumber
    },
    contentOid: 4n
  });

describe('document version allocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.document.update.mockResolvedValue({});
    db.documentVersion.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      content: {}
    }));
  });

  it('normalizes a counter behind the actual maximum before allocating', async () => {
    db.documentVersion.aggregate.mockResolvedValue({
      _max: { versionNumber: 5 }
    });

    let version = await createVersion(2);

    expect(version.versionNumber).toBe(6);
    expect(db.document.update).toHaveBeenNthCalledWith(1, {
      where: { oid: 3n },
      data: { maxVersionNumber: 5 }
    });
    expect(db.document.update).toHaveBeenNthCalledWith(2, {
      where: { oid: 3n },
      data: { maxVersionNumber: 6 }
    });
  });

  it('normalizes a counter ahead of the actual maximum before allocating', async () => {
    db.documentVersion.aggregate.mockResolvedValue({
      _max: { versionNumber: 5 }
    });

    let version = await createVersion(9);

    expect(version.versionNumber).toBe(6);
    expect(db.document.update).toHaveBeenNthCalledWith(1, {
      where: { oid: 3n },
      data: { maxVersionNumber: 5 }
    });
    expect(db.document.update).toHaveBeenNthCalledWith(2, {
      where: { oid: 3n },
      data: { maxVersionNumber: 6 }
    });
  });

  it('creates version one for an empty history', async () => {
    db.documentVersion.aggregate.mockResolvedValue({
      _max: { versionNumber: null }
    });

    let version = await createVersion(1);

    expect(version.versionNumber).toBe(1);
    expect(db.document.update).toHaveBeenNthCalledWith(1, {
      where: { oid: 3n },
      data: { maxVersionNumber: 0 }
    });
    expect(db.document.update).toHaveBeenNthCalledWith(2, {
      where: { oid: 3n },
      data: { maxVersionNumber: 1 }
    });
  });

  it('creates the version and updates the counter in one transaction', async () => {
    db.documentVersion.aggregate.mockResolvedValue({
      _max: { versionNumber: 5 }
    });

    await createVersion(5);

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(db.documentVersion.create).toHaveBeenCalledWith({
      data: {
        oid: 100n,
        id: 'dver_generated',
        projectOid: 5n,
        instanceOid: 6n,
        documentOid: 3n,
        versionNumber: 6,
        contentOid: 4n,
        previousVersionOid: null,
        listEditedAt: undefined
      },
      include: {
        content: true
      }
    });
    expect(db.document.update).toHaveBeenCalledTimes(1);
    expect(db.document.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: { maxVersionNumber: 6 }
    });
  });
});
