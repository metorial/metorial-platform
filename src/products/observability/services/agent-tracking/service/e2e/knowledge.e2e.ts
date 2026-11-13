import { gzipSync } from 'node:zlib';
import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { knowledgeCatalog } from '@mtsrc/agent-tracking-module-knowledge/test/fixture';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import { createToken, agentTracking, rpcErrorCode } from './support';

describe('model knowledge', () => {
  it('imports a snapshot and prices sessions with it', async () => {
    let imported = await importKnowledge();
    expect(imported.status).toBe('applied');

    let again = await importKnowledge();
    expect(again).toMatchObject({ status: 'applied' });
    if (again.status == 'applied') {
      expect(again.counts.offering).toMatchObject({ added: 0, changed: 0, removed: 0 });
    }

    let { organization, instance, secret } = await createToken();
    let sessionId = uniqueId('session');

    await sendClaudeApiRequest({
      secret,
      sessionId,
      model: 'claude-sonnet-4-5-20250929',
      inputTokens: 1_000_000,
      outputTokens: 100_000
    });

    let session = await eventually(async () => {
      let list = await agentTracking().session.list({
        organizationId: organization.id,
        instanceIds: [instance.id]
      });
      expect(list.items).toHaveLength(1);

      return list.items[0]!;
    });

    let fetched = await agentTracking().session.get({
      organizationId: organization.id,
      sessionKey: session.sessionKey
    });

    expect(fetched.summary!.models).toEqual([
      expect.objectContaining({
        modelId: 'claude-sonnet-4-5',
        rawIds: ['claude-sonnet-4-5-20250929'],
        requests: 1,
        costComputedUsd: '4.5'
      })
    ]);
  });

  it('refuses a snapshot older than the current one and an invalid archive', async () => {
    await importKnowledge();

    let olderArchive = gzipSync(
      JSON.stringify(knowledgeCatalog({ generatedAt: '2020-01-01T00:00:00.000Z' }))
    ).toString('base64');

    expect(
      await rpcErrorCode(agentTracking().knowledge.snapshots.import({ archive: olderArchive }))
    ).toBe('precondition_failed');
    expect(
      await rpcErrorCode(
        agentTracking().knowledge.snapshots.import({ archive: 'bm90IGd6aXA=' })
      )
    ).toBe('bad_request');
  });
});
