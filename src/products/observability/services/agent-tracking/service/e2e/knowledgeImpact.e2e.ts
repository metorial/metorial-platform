import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { textPricing } from '@mtsrc/agent-tracking-module-knowledge/test/fixture';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import { createToken, agentTracking, rpcErrorCode } from './support';

let minuteMs = 60 * 1000;
let sonnetOfferingId = 'anthropic:claude-sonnet-4-5-20250929';

describe('model knowledge impact', { timeout: 150_000 }, () => {
  it('reprices sessions a price correction covers', async () => {
    await importKnowledge();

    let { organization, instance, secret } = await createToken();
    let at = new Date(
      Date.now() - 2 * 24 * 60 * minuteMs - Math.floor(Math.random() * 600) * minuteMs
    );

    await sendClaudeApiRequest({
      secret,
      sessionId: uniqueId('session'),
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      at
    });

    let costOf = async () => {
      let list = await agentTracking().session.list({
        organizationId: organization.id,
        instanceIds: [instance.id]
      });
      expect(list.items).toHaveLength(1);

      let session = await agentTracking().session.get({
        organizationId: organization.id,
        sessionKey: list.items[0]!.sessionKey
      });

      return session.summary?.costComputedUsd;
    };

    let before = await eventually(
      async () => {
        let cost = await costOf();
        expect(cost).toBeDefined();

        return cost;
      },
      { timeoutMs: 60_000 }
    );

    let corrected = await agentTracking().knowledge.prices.correct({
      offeringId: sonnetOfferingId,
      from: new Date(at.getTime() - minuteMs),
      to: new Date(at.getTime() + minuteMs),
      pricing: textPricing(1),
      reason: 'Preview pricing missing upstream',
      correctedBy: 'e2e@example.com'
    });

    expect(corrected.offeringId).toBe(sonnetOfferingId);
    expect(corrected.periods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          object: 'agent_tracking#knowledge_price_period',
          origin: 'correction',
          correctionReason: 'Preview pricing missing upstream',
          correctedBy: 'e2e@example.com'
        })
      ])
    );

    let after = await eventually(
      async () => {
        let cost = await costOf();
        expect(cost).toBe('1.5');

        return cost;
      },
      { timeoutMs: 60_000 }
    );
    expect(after).not.toBe(before);
  });

  it('rejects corrections for unknown offerings and empty ranges', async () => {
    await importKnowledge();

    let at = new Date();
    let correct = (input: { offeringId: string; from: Date; to: Date }) =>
      agentTracking().knowledge.prices.correct({
        ...input,
        pricing: textPricing(1),
        reason: 'e2e',
        correctedBy: 'e2e@example.com'
      });

    expect(
      await rpcErrorCode(
        correct({
          offeringId: 'nobody:nothing',
          from: new Date(at.getTime() - minuteMs),
          to: at
        })
      )
    ).toBe('not_found');
    expect(
      await rpcErrorCode(
        correct({
          offeringId: sonnetOfferingId,
          from: at,
          to: new Date(at.getTime() - minuteMs)
        })
      )
    ).toBe('bad_request');
  });
});
