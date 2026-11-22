import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: { recordEvent }
}));

vi.mock('@metorial/db', () => ({ addAfterTransactionHook }));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn() }
}));

import { recordAiToolPolicyUpdated } from './aiTool';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
};

let decidedAt = new Date('2026-11-22T10:00:00Z');

let policy = {
  oid: 5n,
  id: 'aitp_1',
  toolKey: 'ollama',
  status: 'not_sanctioned',
  note: 'Use the approved gateway instead.',
  decidedAt,
  decidedByActorOid: 4n,
  instanceOid: 3n,
  createdAt: decidedAt,
  updatedAt: decidedAt
};

describe('AI tool audit listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordEvent.mockResolvedValue(undefined);
  });

  it('records the first decision on a tool as a creation', async () => {
    await recordAiToolPolicyUpdated({
      aiToolPolicy: policy,
      previousAiToolPolicy: null,
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'ai_tool_policy', 'create', {
      payload: {
        id: 'aitp_1',
        toolKey: 'ollama',
        status: 'not_sanctioned',
        note: 'Use the approved gateway instead.',
        decidedAt
      },
      recordedAt: expect.any(Date)
    });
  });

  it('records a changed decision with the previous one', async () => {
    await recordAiToolPolicyUpdated({
      aiToolPolicy: { ...policy, status: 'sanctioned' },
      previousAiToolPolicy: policy,
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'ai_tool_policy',
      'update',
      expect.objectContaining({
        payload: expect.objectContaining({ status: 'sanctioned' }),
        previousPayload: expect.objectContaining({ status: 'not_sanctioned' })
      })
    );
  });
});
