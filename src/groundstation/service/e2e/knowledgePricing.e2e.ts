import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import { createToken, groundstation } from './support';

describe('model knowledge pricing', () => {
  it('prices each request at the price valid when it happened', async () => {
    await importKnowledge();

    let { organization, instance, secret } = await createToken();
    let sessionId = uniqueId('session');
    let request = (at: Date) =>
      sendClaudeApiRequest({
        secret,
        sessionId,
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        at
      });

    await request(new Date());
    await importKnowledge({ sonnetInput: 2.5 });
    await request(new Date());

    let session = await eventually(async () => {
      let list = await groundstation().session.list({
        organizationId: organization.id,
        instanceIds: [instance.id]
      });
      expect(list.items).toHaveLength(1);

      let fetched = await groundstation().session.get({
        organizationId: organization.id,
        sessionKey: list.items[0]!.sessionKey
      });
      expect(fetched.summary?.requests).toBe(2);

      return fetched;
    });

    expect(session.summary!.costComputedUsd).toBe('8.25');
    expect(session.summary!.models).toHaveLength(1);

    let [model] = session.summary!.models;
    expect(model).toMatchObject({
      modelId: 'claude-sonnet-4-5',
      requests: 2,
      costComputedUsd: '8.25',
      vendorId: 'anthropic',
      vendorSource: 'offering',
      offeringId: 'anthropic:claude-sonnet-4-5-20250929',
      priceAssumed: false
    });
    expect(model!.pricePeriodIds).toHaveLength(2);
    expect(model!.pricePeriodIds.every(id => id.startsWith('gpp_'))).toBe(true);
    expect(new Set(model!.pricePeriodIds).size).toBe(2);
  });
});
