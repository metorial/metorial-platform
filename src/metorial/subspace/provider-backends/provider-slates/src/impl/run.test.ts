import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveReceiverBoundToolSelectorFromAuthority } from './receiverBoundToolSelector';

let mocks = { findMany: vi.fn() };

let resolve = (input: unknown) =>
  resolveReceiverBoundToolSelectorFromAuthority({
    tenantOid: 101n,
    providerConfigVersionOid: 202n,
    providerAuthConfigVersionOid: 303n,
    input,
    findMany: mocks.findMany
  });

beforeEach(() => {
  mocks.findMany.mockReset();
});

describe('provider-slates receiver-bound tool selector', () => {
  it.each([
    { receiverId: 'receiver-from-model' },
    { nested: { receiverCallbackSelector: 'selector-from-model' } },
    { callback: { webhookUrl: 'https://attacker.test' } },
    { callback: { callbackSecret: 'attacker-secret' } },
    { metadata: [{ registrationGeneration: 9 }] },
    { url: 'https://attacker.test' },
    { secret: 'attacker-secret' }
  ])('rejects caller-supplied receiver authority before database resolution', async input => {
    await expect(resolve(input)).rejects.toThrow(
      'Receiver callback fields are not permitted in public tool input'
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('derives exactly one selector from authenticated tenant and config authority', async () => {
    mocks.findMany.mockResolvedValueOnce([{ slateTriggerReceiverId: 'trusted-receiver' }]);

    await expect(resolve({ prompt: 'Fix the failing tests' })).resolves.toBe(
      'trusted-receiver'
    );
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        isParentDeleted: false,
        status: 'attached',
        registrationStatus: 'registered',
        slateTriggerReceiverId: { not: null },
        callback: {
          tenantOid: 101n,
          status: 'active',
          callbackProviderTriggers: {
            some: { providerTrigger: { key: 'agent_status_change' } }
          }
        },
        providerDeploymentConfigPair: {
          tenantOid: 101n,
          providerConfigVersionOid: 202n,
          providerAuthConfigVersionOid: 303n
        }
      },
      select: { slateTriggerReceiverId: true },
      take: 2
    });
  });

  it.each([
    { matches: [] },
    {
      matches: [{ slateTriggerReceiverId: 'first' }, { slateTriggerReceiverId: 'second' }]
    }
  ])('fails closed for zero or ambiguous eligible receivers', async ({ matches }) => {
    mocks.findMany.mockResolvedValueOnce(matches);
    await expect(resolve({ prompt: 'Run agent' })).rejects.toThrow(
      'Exactly one eligible attached callback receiver is required'
    );
  });
});
