import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, fire, forceSkillDestinationSync } = vi.hoisted(() => ({
  db: { skillDestinationSync: { findFirst: vi.fn() } },
  fire: vi.fn(),
  forceSkillDestinationSync: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: async (run: (tx: typeof db) => unknown) => run(db)
}));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));
vi.mock('@metorial/list-utils', () => ({}));
vi.mock('@metorial/skills-scm-utils', () => ({}));
vi.mock('../lib/destinationSync', () => ({ forceSkillDestinationSync }));

import { skillSyncService } from './skillSync';

let scope = {
  project: { oid: 1n } as any,
  instance: { oid: 2n } as any,
  auditScope: { actor: 'user' } as any
};

describe('forcing a skill sync', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.skillDestinationSync.findFirst.mockImplementation(async ({ where }) => ({
      id: where.id,
      destination: { oid: 5n, id: 'destination_1', storageMode: 'manifest' }
    }));
    forceSkillDestinationSync.mockResolvedValue({ id: 'sync_forced', allowMassDelete: true });
  });

  it('starts a manual sync that may delete unexpected files and audit logs it', async () => {
    let forced = await skillSyncService.forceSkillSync({
      ...scope,
      skillSyncId: 'sync_failed',
      allowMassDelete: true
    });

    expect(forceSkillDestinationSync).toHaveBeenCalledWith({
      destination: expect.objectContaining({ oid: 5n }),
      trigger: 'manual',
      allowMassDelete: true
    });
    expect(fire).toHaveBeenCalledWith('skill.destination.audit.sync_forced:after', {
      auditScope: scope.auditScope,
      skillDestination: expect.objectContaining({ id: 'destination_1' }),
      skillDestinationSync: { id: 'sync_forced', allowMassDelete: true }
    });
    expect(forced.id).toBe('sync_forced');
  });

  it('only allows mass deletes for manifest destinations', async () => {
    db.skillDestinationSync.findFirst.mockResolvedValue({
      id: 'sync_failed',
      destination: { oid: 5n, storageMode: 'code_bucket' }
    });

    await expect(
      skillSyncService.forceSkillSync({
        ...scope,
        skillSyncId: 'sync_failed',
        allowMassDelete: true
      })
    ).rejects.toBeInstanceOf(ServiceError);
    expect(forceSkillDestinationSync).not.toHaveBeenCalled();
  });
});
