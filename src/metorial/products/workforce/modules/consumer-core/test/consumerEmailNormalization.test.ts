import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let model = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  });

  return {
    consumer: model(),
    instanceConsumer: model(),
    consumerProfile: model(),
    consumerUpdatedAdd: vi.fn(),
    consumerCreatedAdd: vi.fn()
  };
});

vi.mock('@metorial/db', () => {
  let db = mocks;

  return {
    db,
    ID: { generateId: vi.fn(async (prefix: string) => `${prefix}_generated`) },
    withTransaction: vi.fn(async callback => await callback(db))
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial/lock', () => ({
  createLock: vi.fn(() => ({
    usingLock: vi.fn(async (_key, callback) => await callback())
  }))
}));

vi.mock('@metorial/module-search', () => ({ searchConsumerIds: vi.fn() }));

vi.mock('../src/queues/lifecycle/consumer', () => ({
  consumerCreatedQueue: { add: mocks.consumerCreatedAdd },
  consumerUpdatedQueue: { add: mocks.consumerUpdatedAdd }
}));

import { consumerEmailEquals, normalizeConsumerEmail } from '../src/lib/consumerEmail';
import { consumerService } from '../src/services/consumer';

let organization = { oid: 900n } as any;
let instance = { oid: 800n } as any;

describe('normalizeConsumerEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeConsumerEmail('  VgBmzap@Herber.Space ')).toBe('vgbmzap@herber.space');
  });

  it('builds a case-insensitive filter from the normalized address', () => {
    expect(consumerEmailEquals(' VgBmzap@herber.space ')).toEqual({
      equals: 'vgbmzap@herber.space',
      mode: 'insensitive'
    });
  });
});

describe('consumerService.upsertConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumerProfile.findMany.mockResolvedValue([]);
  });

  it('looks consumers up case-insensitively', async () => {
    mocks.instanceConsumer.findFirst.mockResolvedValue(null);
    mocks.consumer.findFirst.mockResolvedValue(null);
    mocks.consumer.upsert.mockResolvedValue({ oid: 1n, id: 'cns_1' });
    mocks.instanceConsumer.upsert.mockResolvedValue({ oid: 2n, id: 'icn_1' });

    await consumerService.upsertConsumer({
      organization,
      instance,
      input: { name: 'Test', email: 'VgBmzap@herber.space' }
    });

    expect(mocks.instanceConsumer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instanceOid: instance.oid,
          email: { equals: 'vgbmzap@herber.space', mode: 'insensitive' }
        }
      })
    );
  });

  it('stores a lowercased address when creating a consumer', async () => {
    mocks.instanceConsumer.findFirst.mockResolvedValue(null);
    mocks.consumer.findFirst.mockResolvedValue(null);
    mocks.consumer.upsert.mockResolvedValue({ oid: 1n, id: 'cns_1' });
    mocks.instanceConsumer.upsert.mockResolvedValue({ oid: 2n, id: 'icn_1' });

    await consumerService.upsertConsumer({
      organization,
      instance,
      input: { name: 'Test', email: 'VgBmzap@herber.space' }
    });

    expect(mocks.consumer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email_organizationOid: {
            email: 'vgbmzap@herber.space',
            organizationOid: organization.oid
          }
        },
        create: expect.objectContaining({ email: 'vgbmzap@herber.space' })
      })
    );
    expect(mocks.instanceConsumer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: 'vgbmzap@herber.space' })
      })
    );
  });

  it('adopts a consumer written before emails were normalized', async () => {
    mocks.instanceConsumer.findFirst.mockResolvedValue(null);
    mocks.consumer.findFirst.mockResolvedValue({ oid: 5n });
    mocks.consumer.update.mockResolvedValue({ oid: 5n, id: 'cns_legacy' });
    mocks.instanceConsumer.upsert.mockResolvedValue({ oid: 2n, id: 'icn_1' });

    await consumerService.upsertConsumer({
      organization,
      instance,
      input: { name: 'Test', email: 'vgbmzap@herber.space' }
    });

    expect(mocks.consumer.upsert).not.toHaveBeenCalled();
    expect(mocks.consumer.update).toHaveBeenCalledWith({
      where: { oid: 5n },
      data: expect.objectContaining({ email: 'vgbmzap@herber.space' })
    });
  });

  it('rewrites a mixed-case instance consumer instead of leaving it as is', async () => {
    mocks.instanceConsumer.findFirst.mockResolvedValue({
      id: 'icn_legacy',
      oid: 2n,
      instanceOid: instance.oid,
      consumerOid: 1n,
      organizationMemberOid: null,
      name: 'Test',
      email: 'VgBmzap@herber.space'
    });
    mocks.instanceConsumer.update.mockResolvedValue({ id: 'icn_legacy', oid: 2n });

    await consumerService.upsertConsumer({
      organization,
      instance,
      input: { name: 'Test', email: 'vgbmzap@herber.space' }
    });

    expect(mocks.instanceConsumer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 2n },
        data: expect.objectContaining({ email: 'vgbmzap@herber.space' })
      })
    );
  });

  it('leaves an already normalized consumer untouched', async () => {
    mocks.instanceConsumer.findFirst.mockResolvedValue({
      id: 'icn_1',
      oid: 2n,
      instanceOid: instance.oid,
      consumerOid: 1n,
      organizationMemberOid: null,
      name: 'Test',
      email: 'vgbmzap@herber.space',
      consumer: { isOrganizationMember: false, isPortalConsumer: false }
    });

    await consumerService.upsertConsumer({
      organization,
      instance,
      input: { name: 'Test', email: 'vgbmzap@herber.space' }
    });

    expect(mocks.instanceConsumer.update).not.toHaveBeenCalled();
    expect(mocks.consumer.update).not.toHaveBeenCalled();
  });
});
