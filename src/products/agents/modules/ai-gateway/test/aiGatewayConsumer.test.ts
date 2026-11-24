import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getConsumerById: vi.fn(),
  findConsumersById: vi.fn()
}));

vi.mock('@metorial/module-consumer-core', () => ({
  consumerService: {
    getConsumerById: mocks.getConsumerById,
    findConsumersById: mocks.findConsumersById
  }
}));

let { aiGatewayConsumerService } = await import('../src/services/aiGatewayConsumer');

let instance = { oid: 1n, id: 'ins_1' } as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('aiGatewayConsumerService', () => {
  it('resolves either kind of consumer id to the instance consumer id', async () => {
    mocks.getConsumerById.mockResolvedValue({ id: 'icon_1' });

    expect(await aiGatewayConsumerService.resolveRef({ instance, consumerId: 'con_9' })).toBe(
      'icon_1'
    );
    expect(mocks.getConsumerById).toHaveBeenCalledWith({ instance, consumerId: 'con_9' });
  });

  it('looks up the consumers of many refs at once, without duplicates or empty refs', async () => {
    mocks.findConsumersById.mockResolvedValue([
      { id: 'icon_1', name: 'Ada' },
      { id: 'icon_2', name: 'Grace' }
    ]);

    let lookup = await aiGatewayConsumerService.findForRefs({
      instance,
      refs: ['icon_1', null, 'icon_2', 'icon_1', undefined, 'icon_3']
    });

    expect(mocks.findConsumersById).toHaveBeenCalledTimes(1);
    expect(mocks.findConsumersById).toHaveBeenCalledWith({
      instance,
      consumerIds: ['icon_1', 'icon_2', 'icon_3']
    });
    expect(lookup.get('icon_2')).toMatchObject({ name: 'Grace' });
    expect(lookup.get('icon_3')).toBeNull();
    expect(lookup.get(null)).toBeNull();
  });
});
