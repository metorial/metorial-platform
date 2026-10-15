import { beforeEach, describe, expect, it, vi } from 'vitest';

let db = {
  sandboxMachineImage: { update: vi.fn() },
  sandboxMachineImageVersion: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  }
};

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: vi.fn(async (fn: any) => fn(db))
}));

let { sandboxImageVersionInternalService } =
  await import('../src/internal/imageVersionInternal');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('sandboxImageVersionInternalService.assignNumbers', () => {
  it('does nothing when every version is numbered', async () => {
    db.sandboxMachineImageVersion.count.mockResolvedValue(0);

    await sandboxImageVersionInternalService.assignNumbers({ imageOid: 10n });

    expect(db.sandboxMachineImageVersion.count).toHaveBeenCalledWith({
      where: { imageOid: 10n, versionNumber: null }
    });
    expect(db.sandboxMachineImage.update).not.toHaveBeenCalled();
    expect(db.sandboxMachineImageVersion.update).not.toHaveBeenCalled();
  });

  it('numbers the unnumbered versions in creation order after the highest number', async () => {
    db.sandboxMachineImageVersion.count.mockResolvedValue(2);
    db.sandboxMachineImageVersion.findFirst.mockResolvedValue({ versionNumber: 4 });
    db.sandboxMachineImageVersion.findMany.mockResolvedValue([{ oid: 31n }, { oid: 35n }]);

    await sandboxImageVersionInternalService.assignNumbers({ imageOid: 10n });

    expect(db.sandboxMachineImageVersion.findFirst).toHaveBeenCalledWith({
      where: { imageOid: 10n, versionNumber: { not: null } },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true }
    });
    expect(db.sandboxMachineImageVersion.findMany).toHaveBeenCalledWith({
      where: { imageOid: 10n, versionNumber: null },
      orderBy: { oid: 'asc' },
      select: { oid: true }
    });
    expect(db.sandboxMachineImageVersion.update.mock.calls.map(call => call[0])).toEqual([
      { where: { oid: 31n }, data: { versionNumber: 5 } },
      { where: { oid: 35n }, data: { versionNumber: 6 } }
    ]);
  });

  it('starts at one for an image without numbered versions', async () => {
    db.sandboxMachineImageVersion.count.mockResolvedValue(1);
    db.sandboxMachineImageVersion.findFirst.mockResolvedValue(null);
    db.sandboxMachineImageVersion.findMany.mockResolvedValue([{ oid: 31n }]);

    await sandboxImageVersionInternalService.assignNumbers({ imageOid: 10n });

    expect(db.sandboxMachineImageVersion.update).toHaveBeenCalledWith({
      where: { oid: 31n },
      data: { versionNumber: 1 }
    });
  });

  it('locks the image row before reading the highest number', async () => {
    let order: string[] = [];
    db.sandboxMachineImageVersion.count.mockResolvedValue(1);
    db.sandboxMachineImage.update.mockImplementation(async () => {
      order.push('lock');
    });
    db.sandboxMachineImageVersion.findFirst.mockImplementation(async () => {
      order.push('latest');
      return null;
    });
    db.sandboxMachineImageVersion.findMany.mockResolvedValue([]);

    await sandboxImageVersionInternalService.assignNumbers({ imageOid: 10n });

    expect(db.sandboxMachineImage.update).toHaveBeenCalledWith({
      where: { oid: 10n },
      data: { updatedAt: expect.any(Date) }
    });
    expect(order).toEqual(['lock', 'latest']);
  });
});
