import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    skill: {
      findFirst: vi.fn()
    },
    storeParticipant: {
      findMany: vi.fn()
    },
    skillParticipant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db,
  withTransaction: vi.fn(async (fn: any) => await fn(db))
}));

vi.mock('@metorial/cargo-config/id', () => ({
  getId: vi.fn(() => ({
    oid: 100n,
    id: 'skp_generated'
  }))
}));

vi.mock('@metorial/cargo-list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  resolveResourceActors: vi.fn(),
  resolveSkillParticipants: vi.fn()
}));

vi.mock('@metorial/cargo-module-store', () => ({
  storeReadPermission: 'content_read',
  storeWritePermission: 'content_write'
}));

import { skillParticipantService } from './skillParticipant';

let scope = {
  resourceTenant: {
    oid: 1n,
    id: 'rtn_1',
    identifier: 'tenant',
    name: 'Tenant',
    image: null,
    organizationName: null,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  },
  resourceGroup: {
    oid: 2n,
    id: 'rgr_1',
    identifier: 'instance',
    name: 'Instance',
    type: 'production' as const,
    resourceTenantOid: 1n,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  }
};
let skill = {
  oid: 3n,
  id: 'skill_1',
  storeOid: 4n
};
let resourceActor = {
  oid: 5n,
  id: 'rac_consumer'
};

describe('skill participant store projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    db.skill.findFirst.mockResolvedValue(skill);
    db.storeParticipant.findMany.mockResolvedValue([]);
    db.skillParticipant.findUnique.mockResolvedValue(null);
    db.skillParticipant.findFirst.mockResolvedValue(null);
    db.skillParticipant.findMany.mockResolvedValue([]);
  });

  it('creates a participant role without a store authorization grant', async () => {
    db.skillParticipant.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      skill,
      resourceActor
    }));

    await skillParticipantService.setSkillParticipantAccessRole({
      skill,
      actor: resourceActor,
      permission: 'read'
    });

    expect(db.skillParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          skillOid: skill.oid,
          resourceActorOid: resourceActor.oid,
          roles: ['viewer']
        })
      })
    );
    expect(db.storeParticipant.findMany).not.toHaveBeenCalled();
  });

  it('retains the participant identity when individual access is removed', async () => {
    let existing = {
      oid: 6n,
      id: 'skp_1',
      skillOid: skill.oid,
      resourceActorOid: resourceActor.oid,
      roles: ['viewer'],
      skill,
      resourceActor
    };
    db.skillParticipant.findUnique.mockResolvedValue(existing);
    db.skillParticipant.update.mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data
    }));

    await skillParticipantService.setSkillParticipantAccessRole({
      skill,
      actor: resourceActor,
      permission: 'none'
    });

    expect(db.skillParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existing.id },
        data: { roles: [] }
      })
    );
    expect(db.skillParticipant.delete).not.toHaveBeenCalled();
  });

  it('does not downgrade an editor when recording read access', async () => {
    db.skillParticipant.findUnique.mockResolvedValue({
      oid: 6n,
      id: 'skp_1',
      skillOid: skill.oid,
      resourceActorOid: resourceActor.oid,
      roles: ['editor'],
      skill,
      resourceActor
    });

    await skillParticipantService.ensureSkillParticipantAccessRole({
      skill,
      actor: resourceActor,
      permission: 'read'
    });

    expect(db.skillParticipant.update).not.toHaveBeenCalled();
    expect(db.skillParticipant.create).not.toHaveBeenCalled();
  });

  it('does not reconcile participant roles while listing', async () => {
    let existing = {
      oid: 6n,
      id: 'skp_1',
      skillOid: skill.oid,
      resourceActorOid: resourceActor.oid,
      roles: ['viewer'],
      skill,
      resourceActor
    };
    db.storeParticipant.findMany.mockResolvedValue([
      {
        storeOid: skill.storeOid,
        resourceActorOid: resourceActor.oid,
        permissions: ['content_read', 'content_write'],
        resourceActor
      }
    ]);
    db.skillParticipant.findMany.mockResolvedValue([existing]);
    db.skillParticipant.update.mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data
    }));

    await skillParticipantService.listSkillParticipants({
      ...scope,
      skillId: skill.id
    });

    expect(db.skillParticipant.update).not.toHaveBeenCalled();
    expect(db.skillParticipant.create).not.toHaveBeenCalled();
  });

  it('does not delete stale participant roles while listing', async () => {
    let existing = {
      oid: 6n,
      id: 'skp_1',
      skillOid: skill.oid,
      resourceActorOid: resourceActor.oid,
      roles: ['viewer'],
      skill,
      resourceActor
    };
    db.storeParticipant.findMany.mockResolvedValue([
      {
        storeOid: skill.storeOid,
        resourceActorOid: resourceActor.oid,
        permissions: [],
        resourceActor
      }
    ]);
    db.skillParticipant.findMany.mockResolvedValue([existing]);

    await skillParticipantService.listSkillParticipants({
      ...scope,
      skillId: skill.id
    });

    expect(db.skillParticipant.delete).not.toHaveBeenCalled();
  });

  it('leaves explicit participant roles unchanged while listing', async () => {
    let existing = {
      oid: 6n,
      id: 'skp_1',
      skillOid: skill.oid,
      resourceActorOid: resourceActor.oid,
      roles: ['creator', 'viewer'],
      skill,
      resourceActor
    };
    db.storeParticipant.findMany.mockResolvedValue([
      {
        storeOid: skill.storeOid,
        resourceActorOid: resourceActor.oid,
        permissions: [],
        resourceActor
      }
    ]);
    db.skillParticipant.findMany.mockResolvedValue([existing]);
    db.skillParticipant.update.mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data
    }));

    await skillParticipantService.listSkillParticipants({
      ...scope,
      skillId: skill.id
    });

    expect(db.skillParticipant.update).not.toHaveBeenCalled();
    expect(db.skillParticipant.delete).not.toHaveBeenCalled();
  });

  it('excludes system organization actors from participant lists', async () => {
    let paginator = await skillParticipantService.listSkillParticipants({
      ...scope,
      skillId: skill.id
    });

    await paginator.run({ limit: 100, order: 'desc' });

    expect(db.skillParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resourceActor: {
            NOT: [
              { type: 'system' },
              {
                organizationActor: {
                  is: { type: 'system' }
                }
              }
            ]
          }
        })
      })
    );
  });

  it('filters system organization actors when looking up a participant by ID', async () => {
    db.skillParticipant.findFirst.mockResolvedValue({
      id: 'skp_1',
      skill,
      resourceActor
    });

    await skillParticipantService.getSkillParticipantById({
      ...scope,
      skillParticipantId: 'skp_1'
    });

    expect(db.skillParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resourceActor: {
            NOT: [
              { type: 'system' },
              {
                organizationActor: {
                  is: { type: 'system' }
                }
              }
            ]
          }
        })
      })
    );
  });
});
