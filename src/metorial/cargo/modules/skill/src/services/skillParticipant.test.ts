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
    db.skillParticipant.findMany.mockResolvedValue([]);
  });

  it('promotes an existing viewer to editor after write permission is projected', async () => {
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

    expect(db.skillParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: existing.id
        },
        data: {
          roles: ['editor']
        }
      })
    );
  });

  it('removes the store-backed role after projected permissions are cleared', async () => {
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

    expect(db.skillParticipant.delete).toHaveBeenCalledWith({
      where: {
        id: existing.id
      }
    });
  });

  it('preserves explicit roles when projected permissions are cleared', async () => {
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

    expect(db.skillParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: existing.id
        },
        data: {
          roles: ['creator']
        }
      })
    );
    expect(db.skillParticipant.delete).not.toHaveBeenCalled();
  });
});
