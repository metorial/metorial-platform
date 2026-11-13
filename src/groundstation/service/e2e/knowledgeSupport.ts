import { gzipSync } from 'node:zlib';
import { uniqueId } from '@lowerdeck/testing-tools';
import type { Catalog } from '@metorial/model-catalog/src/types';
import { expect } from 'vitest';
import { knowledgeCatalog } from '../src/knowledge/tests/fixture';
import { groundstation, ingest } from './support';

type CatalogOptions = Parameters<typeof knowledgeCatalog>[0] & {
  extend?: (catalog: Catalog) => void;
};

export let importKnowledge = async (options: CatalogOptions = {}) => {
  let { extend, ...catalogOptions } = options;
  let catalog = knowledgeCatalog({ ...catalogOptions, generatedAt: new Date().toISOString() });
  extend?.(catalog);

  let archive = gzipSync(JSON.stringify(catalog)).toString('base64');

  let result = await groundstation().knowledge.snapshots.import({
    archive,
    guardrails: false
  });
  expect(result.status).not.toBe('rejected');

  return result;
};

let attr = (key: string, value: string | number) => ({
  key,
  value: typeof value == 'number' ? { intValue: String(value) } : { stringValue: value }
});

export let sendClaudeApiRequest = async (d: {
  secret: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  at?: Date;
  requestId?: string;
}) => {
  let at = d.at ?? new Date();

  let response = await ingest('/v1/logs', {
    credential: d.secret,
    body: JSON.stringify({
      resourceLogs: [
        {
          resource: { attributes: [attr('service.name', 'claude-code')] },
          scopeLogs: [
            {
              scope: { name: 'com.anthropic.claude_code.events' },
              logRecords: [
                {
                  timeUnixNano: String(BigInt(at.getTime()) * 1_000_000n),
                  body: { stringValue: 'claude_code.api_request' },
                  attributes: [
                    attr('event.name', 'api_request'),
                    attr('session.id', d.sessionId),
                    attr('request_id', d.requestId ?? uniqueId('req')),
                    attr('model', d.model),
                    attr('input_tokens', d.inputTokens),
                    attr('output_tokens', d.outputTokens)
                  ]
                }
              ]
            }
          ]
        }
      ]
    })
  });

  expect(response.status).toBe(200);
};
