import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let state = {
    skills: [] as { oid: bigint; id: string; instanceOid: bigint }[],
    deviceSkills: [] as { oid: bigint; name: string; skillOid: bigint }[]
  };

  let db = {
    consumerDevice: { findUnique: vi.fn(), update: vi.fn() },
    mcpClientType: { createMany: vi.fn(), findMany: vi.fn(async () => []) },
    consumerDeviceClient: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
    magicMcpToken: { updateMany: vi.fn() },
    skill: {
      findMany: vi.fn(async (query: any) =>
        state.skills.filter(
          skill =>
            query.where.id.in.includes(skill.id) &&
            skill.instanceOid == query.where.instanceOid
        )
      )
    },
    consumerDeviceSkill: {
      findMany: vi.fn(async () => state.deviceSkills),
      deleteMany: vi.fn(),
      createMany: vi.fn()
    }
  };

  return { db, state };
});

vi.mock('@metorial/db', () => ({
  db: mocks.db,
  ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_generated`) },
  ConsumerDeviceStatus: { active: 'active', signed_out: 'signed_out', revoked: 'revoked' },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  addAfterTransactionHook: vi.fn(),
  withTransaction: vi.fn(async (callback: any) => await callback(mocks.db))
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));

vi.mock('@metorial/module-machine-access', () => ({
  oauthAuthorizationService: { revokeOAuthToken: vi.fn() }
}));

vi.mock('../src/lib/aiToolDetection', () => ({ visibleDetectionWhere: () => ({}) }));

import { consumerDeviceService } from '../src/services/consumerDevice';

let instance = { oid: 3n, id: 'inst_1' } as any;

let consumerProfile = { oid: 88n, id: 'cop_1' } as any;

let oauthToken = {
  oid: 50n,
  oauthAuthorization: { subjectType: 'consumer', oauthApplication: { type: 'cli_auth' } }
} as any;

let checkIn = (reportedSkills?: { skillId: string; name: string }[]) =>
  consumerDeviceService.checkInDevice({
    instance,
    consumerProfile,
    oauthToken,
    auditScope: {} as any,
    input: {
      installationId: 'a'.repeat(32),
      name: 'Mac',
      os: 'macos',
      arch: 'aarch64',
      appVersion: '1.0.0',
      reportedClients: [],
      reportedSkills
    }
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.consumerDevice.findUnique.mockResolvedValue({
    oid: 9n,
    status: 'active',
    oauthTokenOid: 50n,
    instanceOid: 3n
  });
  mocks.db.consumerDevice.update.mockResolvedValue({ oid: 9n });
  mocks.state.skills = [
    { oid: 10n, id: 'skl_billing', instanceOid: 3n },
    { oid: 12n, id: 'skl_review', instanceOid: 3n },
    { oid: 20n, id: 'skl_foreign', instanceOid: 4n }
  ];
  mocks.state.deviceSkills = [
    { oid: 1n, name: 'billing', skillOid: 10n },
    { oid: 2n, name: 'retired', skillOid: 12n }
  ];
});

describe('device check-in skills', () => {
  it('replaces the stored list, keeping rows that did not change', async () => {
    await checkIn([
      { skillId: 'skl_billing', name: 'billing' },
      { skillId: 'skl_review', name: 'review' }
    ]);

    expect(mocks.db.skill.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['skl_billing', 'skl_review'] }, instanceOid: 3n, status: 'active' }
    });
    expect(mocks.db.consumerDeviceSkill.deleteMany).toHaveBeenCalledWith({
      where: { oid: { in: [2n] } }
    });
    expect(mocks.db.consumerDeviceSkill.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'consumerDeviceSkill_generated',
          name: 'review',
          consumerDeviceOid: 9n,
          skillOid: 12n,
          instanceOid: 3n
        }
      ]
    });
  });

  it('moves a name to the skill now installed under it', async () => {
    await checkIn([
      { skillId: 'skl_review', name: 'billing' },
      { skillId: 'skl_review', name: 'retired' }
    ]);

    expect(mocks.db.consumerDeviceSkill.deleteMany).toHaveBeenCalledWith({
      where: { oid: { in: [1n] } }
    });
    expect(mocks.db.consumerDeviceSkill.createMany.mock.calls[0]![0].data).toMatchObject([
      { name: 'billing', skillOid: 12n }
    ]);
  });

  it('keeps the stored list when the app leaves it out', async () => {
    await checkIn(undefined);

    expect(mocks.db.skill.findMany).not.toHaveBeenCalled();
    expect(mocks.db.consumerDeviceSkill.findMany).not.toHaveBeenCalled();
    expect(mocks.db.consumerDeviceSkill.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.consumerDeviceSkill.createMany).not.toHaveBeenCalled();
  });

  it('ignores skills of other instances and names reported twice', async () => {
    mocks.state.deviceSkills = [];

    await checkIn([
      { skillId: 'skl_foreign', name: 'foreign' },
      { skillId: 'skl_missing', name: 'missing' },
      { skillId: 'skl_billing', name: 'billing' },
      { skillId: 'skl_review', name: 'billing' }
    ]);

    expect(mocks.db.consumerDeviceSkill.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.consumerDeviceSkill.createMany.mock.calls[0]![0].data).toEqual([
      expect.objectContaining({ name: 'billing', skillOid: 10n })
    ]);
  });

  it('clears the stored list when the app reports none', async () => {
    await checkIn([]);

    expect(mocks.db.consumerDeviceSkill.deleteMany).toHaveBeenCalledWith({
      where: { oid: { in: [1n, 2n] } }
    });
    expect(mocks.db.consumerDeviceSkill.createMany).not.toHaveBeenCalled();
  });
});
