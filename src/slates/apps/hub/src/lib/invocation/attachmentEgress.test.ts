import { describe, expect, it } from 'vitest';
import { attachmentEgressFor, resolveAttachmentEgress } from './attachmentEgress';

let instanceConfiguration = {
  oid: 7n,
  enclaveId: 'enc_session',
  egressPolicy: { entries: [{ cidr: '10.0.0.0/8' }] }
} as any;

let inlinePolicy = { entries: [{ cidr: '192.168.0.0/16' }] } as any;

describe('attachmentEgressFor', () => {
  it('links the session instance configuration', () => {
    expect(attachmentEgressFor({ instanceConfiguration })).toEqual({
      instanceConfigurationOid: 7n
    });
  });

  it('copies inline policies, filling gaps from the instance configuration', () => {
    expect(
      attachmentEgressFor({ instanceConfiguration, inline: { egressPolicy: inlinePolicy } })
    ).toEqual({ enclaveId: 'enc_session', egressPolicy: inlinePolicy });

    expect(attachmentEgressFor({ inline: { enclaveId: 'enc_inline' } })).toEqual({
      enclaveId: 'enc_inline',
      egressPolicy: undefined
    });
  });

  it('records nothing without a policy', () => {
    expect(attachmentEgressFor({})).toEqual({});
  });
});

describe('resolveAttachmentEgress', () => {
  it('reads the live policy of a linked instance configuration', () => {
    expect(
      resolveAttachmentEgress({
        instanceConfiguration,
        enclaveId: 'enc_stale',
        egressPolicy: inlinePolicy
      })
    ).toEqual({ enclaveId: 'enc_session', egressPolicy: instanceConfiguration.egressPolicy });
  });

  it('falls back to the copied policy', () => {
    expect(
      resolveAttachmentEgress({
        instanceConfiguration: null,
        enclaveId: 'enc_inline',
        egressPolicy: inlinePolicy
      })
    ).toEqual({ enclaveId: 'enc_inline', egressPolicy: inlinePolicy });
  });
});
