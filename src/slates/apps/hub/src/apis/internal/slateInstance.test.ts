import { describe, expect, it } from 'vitest';
import {
  aggregateSlateConfigLifecycle,
  assertCanonicalStoredSlateConfigSchema,
  parseSlateConfigFieldDescriptors,
  projectSlateConfigPresence,
  resolveStoredSlateConfigFieldDescriptors,
  validateSlateConfigPatch
} from '../../lib/configPatch';
import { computeSlateConfigSchemaV2Hash } from '@slates/proto';

let fields = {
  endpoint: { visibility: 'plain' as const, lifecycle: 'none' as const },
  signingSecret: { visibility: 'secret' as const, lifecycle: 'projection' as const },
  renewalToken: { visibility: 'secret' as const, lifecycle: 'renew' as const },
  account: { visibility: 'plain' as const, lifecycle: 'reregister' as const }
};

describe('slate instance config patch contract', () => {
  it('accepts set/remove while omission preserves every other key', () => {
    expect(
      validateSlateConfigPatch({
        patch: { set: { endpoint: 'https://new.example' }, remove: ['renewalToken'] },
        fields
      })
    ).toMatchObject({
      set: { endpoint: 'https://new.example' },
      remove: ['renewalToken']
    });
  });

  for (let [name, patch, code] of [
    ['empty', {}, 'empty_config_patch'],
    ['unknown', { set: { other: true } }, 'unknown_config_key'],
    ['duplicate remove', { remove: ['endpoint', 'endpoint'] }, 'duplicate_config_remove'],
    [
      'overlap',
      { set: { endpoint: 'value' }, remove: ['endpoint'] },
      'overlapping_config_patch'
    ]
  ] as const) {
    it(`rejects ${name}`, () => {
      expect(() => validateSlateConfigPatch({ patch, fields })).toThrow();
      try {
        validateSlateConfigPatch({ patch, fields });
      } catch (error) {
        expect(JSON.stringify(error)).toContain(code);
      }
    });
  }

  it('defaults allowlisted v1 keys to secret plus reregister', () => {
    expect(
      validateSlateConfigPatch({
        patch: { set: { legacy: 'sentinel' } },
        fields: {},
        allowV1Loose: true
      }).fields
    ).toEqual({ legacy: { visibility: 'secret', lifecycle: 'reregister' } });
  });

  it('projects classified fields as presence only', () => {
    let projected = projectSlateConfigPresence({
      value: {
        endpoint: 'https://example.com',
        signingSecret: 'sentinel',
        renewalToken: { type: 'metorial.instance_config_secret/v1', configured: true },
        unknown: 'drop'
      },
      fields
    });
    expect(projected).toEqual({
      endpoint: 'https://example.com',
      signingSecret: { configured: true },
      renewalToken: { configured: true }
    });
    expect(JSON.stringify(projected)).not.toContain('sentinel');
  });

  it('rejects stale or malformed persisted descriptors', () => {
    expect(parseSlateConfigFieldDescriptors(fields)).toEqual(fields);
    expect(() =>
      parseSlateConfigFieldDescriptors({
        secret: { visibility: 'secret', lifecycle: 'renew', extra: 'drift' }
      })
    ).toThrow(/invalid/);
  });

  it('classifies every stored v1 key as secret and reregister', () => {
    expect(
      resolveStoredSlateConfigFieldDescriptors({
        schemaVersion: 1,
        fields: {},
        value: { apiKey: 'legacy-secret', region: 'legacy-region' }
      })
    ).toEqual({
      apiKey: { visibility: 'secret', lifecycle: 'reregister' },
      region: { visibility: 'secret', lifecycle: 'reregister' }
    });
  });

  it('aggregates projection before one plan-exact registration transition', () => {
    expect(
      aggregateSlateConfigLifecycle({
        changedKeys: ['renewalToken', 'signingSecret', 'account', 'signingSecret'],
        fields
      })
    ).toEqual({
      changedKeys: ['account', 'renewalToken', 'signingSecret'],
      projectionKeys: ['signingSecret'],
      registrationIntent: 'reregister'
    });
    expect(
      aggregateSlateConfigLifecycle({ changedKeys: ['renewalToken'], fields })
        .registrationIntent
    ).toBe('renew');
  });

  it('rejects stale persisted descriptor claims', () => {
    let jsonSchema = { type: 'object', properties: {} };
    let fieldOrder = Object.keys(fields).sort();
    let hash = computeSlateConfigSchemaV2Hash({
      version: 2,
      fieldOrder,
      fields,
      jsonSchema
    });
    expect(
      assertCanonicalStoredSlateConfigSchema({
        version: 2,
        descriptorHash: hash,
        fields,
        schema: jsonSchema
      }).hash
    ).toBe(hash);
    expect(() =>
      assertCanonicalStoredSlateConfigSchema({
        version: 2,
        descriptorHash: '0'.repeat(64),
        fields,
        schema: jsonSchema
      })
    ).toThrow(/stale or fabricated/);
  });
});
