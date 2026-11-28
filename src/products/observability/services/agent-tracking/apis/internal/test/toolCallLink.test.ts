import { describe, expect, it } from 'vitest';
import { upsertToolCallLinksInput } from '../src/toolCallLink';

let scope = { organizationId: 'org_1', instanceId: 'ins_1' };

let links = (count: number, overrides: Record<string, unknown> = {}) =>
  Array.from({ length: count }, (_, index) => ({
    clientFamily: 'codex',
    toolCallId: `call_${index}`,
    calledAt: new Date('2026-11-27T10:00:00Z'),
    metorial: { toolCallId: `tcal_${index}`, providerId: 'pro_1', toolKey: 'search' },
    ...overrides
  }));

let valid = (input: Record<string, unknown>) =>
  upsertToolCallLinksInput.validate({ ...scope, ...input }).success;

describe('toolCallLink.upsert input', () => {
  it('takes up to 200 links', () => {
    expect(valid({ links: [] })).toBe(true);
    expect(valid({ links: links(200) })).toBe(true);
    expect(valid({ links: links(201) })).toBe(false);
  });

  it('takes the optional deployment, integration and server ids', () => {
    expect(
      valid({
        links: links(1, {
          metorial: {
            toolCallId: 'tcal_1',
            providerId: 'pro_1',
            toolKey: 'search',
            deploymentId: 'pdep_1',
            integrationId: 'int_1',
            magicMcpServerId: 'mms_1'
          }
        })
      })
    ).toBe(true);
  });

  it('refuses links without the agent call, the Metorial call or the provider', () => {
    expect(valid({ links: links(1, { toolCallId: '' }) })).toBe(false);
    expect(valid({ links: links(1, { clientFamily: '' }) })).toBe(false);
    expect(
      valid({ links: links(1, { metorial: { toolCallId: 'tcal_1', toolKey: 'search' } }) })
    ).toBe(false);
    expect(
      valid({ links: links(1, { metorial: { providerId: 'pro_1', toolKey: 'search' } }) })
    ).toBe(false);
  });

  it('takes a link without a tool key, as sent while Detailed Tool Reporting is off', () => {
    expect(
      valid({ links: links(1, { metorial: { toolCallId: 'tcal_1', providerId: 'pro_1' } }) })
    ).toBe(true);
    expect(
      valid({
        links: links(1, {
          metorial: { toolCallId: 'tcal_1', providerId: 'pro_1', toolKey: '' }
        })
      })
    ).toBe(false);
  });

  it('needs the instance', () => {
    expect(
      upsertToolCallLinksInput.validate({ organizationId: 'org_1', links: links(1) }).success
    ).toBe(false);
  });
});
