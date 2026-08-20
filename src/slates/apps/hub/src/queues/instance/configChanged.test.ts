import { computeSlateConfigSchemaV2Hash } from '@slates/proto';
import { describe, expect, it } from 'vitest';
import {
  buildConfigChangedFailureUpdate,
  configChangedJobMatches,
  mergeProviderConfigOutput,
  projectConfigChangedPayload
} from './configChangedPolicy';

let canonicalSchema = (d: {
  fields: Record<string, { visibility: 'plain' | 'secret'; lifecycle: 'none' | 'projection' }>;
  properties: Record<string, unknown>;
}) => ({
  version: 2,
  descriptorHash: computeSlateConfigSchemaV2Hash({
    version: 2,
    fieldOrder: Object.keys(d.fields).sort(),
    fields: d.fields,
    jsonSchema: {
      type: 'object',
      properties: d.properties,
      additionalProperties: false
    }
  }),
  fields: d.fields,
  schema: {
    type: 'object',
    properties: d.properties,
    additionalProperties: false
  }
});

describe('configChanged queue boundary', () => {
  it('rejects stale generation/schema work', () => {
    expect(
      configChangedJobMatches({
        currentGeneration: 4,
        currentSchemaHash: 'schema-a',
        configGeneration: 4,
        configSchemaHash: 'schema-a'
      })
    ).toBe(true);
    expect(
      configChangedJobMatches({
        currentGeneration: 5,
        currentSchemaHash: 'schema-a',
        configGeneration: 4,
        configSchemaHash: 'schema-a'
      })
    ).toBe(false);
    expect(
      configChangedJobMatches({
        currentGeneration: 4,
        currentSchemaHash: 'schema-b',
        configGeneration: 4,
        configSchemaHash: 'schema-a'
      })
    ).toBe(false);
  });

  it('merges only declared plain provider output', () => {
    expect(
      mergeProviderConfigOutput({
        stored: {
          endpoint: 'old',
          secret: { type: 'metorial.instance_config_secret/v1', configured: true }
        },
        providerOutput: { endpoint: 'normalized' },
        schema: canonicalSchema({
          fields: {
            endpoint: { visibility: 'plain', lifecycle: 'none' },
            secret: { visibility: 'secret', lifecycle: 'projection' }
          },
          properties: { endpoint: { type: 'string' }, secret: { type: 'string' } }
        })
      })
    ).toEqual({
      endpoint: 'normalized',
      secret: { type: 'metorial.instance_config_secret/v1', configured: true }
    });
  });

  it('rejects undeclared provider output before persistence', () => {
    expect(() =>
      mergeProviderConfigOutput({
        stored: {},
        providerOutput: { injected: 'sentinel' },
        schema: canonicalSchema({ fields: {}, properties: {} })
      })
    ).toThrow(/undeclared/);
  });

  it('rejects classified provider output before persistence', () => {
    expect(() =>
      mergeProviderConfigOutput({
        stored: { secret: { configured: true } },
        providerOutput: { secret: 'provider-sentinel' },
        schema: canonicalSchema({
          fields: { secret: { visibility: 'secret', lifecycle: 'projection' } },
          properties: { secret: { type: 'string' } }
        })
      })
    ).toThrow(/classified/);
  });

  it.each([
    ['wrong root type', { endpoint: 42 }],
    ['wrong nested type', { endpoint: { url: 42 } }]
  ] as const)('rejects %s against the independently loaded canonical schema', (_name, providerOutput) => {
    expect(() =>
      mergeProviderConfigOutput({
        stored: {},
        providerOutput,
        schema: canonicalSchema({
          fields: { endpoint: { visibility: 'plain', lifecycle: 'none' } },
          properties: {
            endpoint: {
              type: 'object',
              properties: { url: { type: 'string' } },
              required: ['url'],
              additionalProperties: false
            }
          }
        })
      })
    ).toThrow();
  });

  it('rejects a stale canonical schema hash before provider output persistence', () => {
    expect(() =>
      mergeProviderConfigOutput({
        stored: {},
        providerOutput: { endpoint: 'safe' },
        schema: {
          ...canonicalSchema({
            fields: { endpoint: { visibility: 'plain', lifecycle: 'none' } },
            properties: { endpoint: { type: 'string' } }
          }),
          descriptorHash: 'f'.repeat(64)
        }
      })
    ).toThrow(/stale or fabricated/);
  });

  it('projects queue payloads to plain values and configured presence', () => {
    let projected = projectConfigChangedPayload({
      schemaVersion: 2,
      fields: {
        endpoint: { visibility: 'plain', lifecycle: 'none' },
        secret: { visibility: 'secret', lifecycle: 'projection' }
      },
      value: { endpoint: 'https://example.com', secret: 'queue-sentinel', unknown: 'drop' }
    });
    expect(projected.config).toEqual({
      endpoint: 'https://example.com',
      secret: { configured: true }
    });
    expect(JSON.stringify(projected.config)).not.toContain('queue-sentinel');
  });

  it('binds production failure writes to the config generation without raw provider errors', () => {
    let update = buildConfigChangedFailureUpdate({
      configOid: 42n,
      configGeneration: 7,
      invocationId: 'invocation-1',
      failure: 'provider_error'
    });
    expect(update).toEqual({
      where: { oid: 42n, generation: 7 },
      data: {
        errorCode: 'provider_config_update_failed',
        errorMessage: 'Provider config update failed.',
        errorInvocationId: 'invocation-1'
      }
    });
    expect(JSON.stringify(update.data)).not.toContain('provider-sentinel');
  });
});
