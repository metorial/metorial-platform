import { readFileSync } from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  functionEgressWarnings,
  internalRanges,
  isInsideInternalRanges
} from './internalRanges';

let egressVectorsPath = new URL(
  '../../../../../products/runtime/packages/egress/testdata/vectors.json',
  import.meta.url
);

let rule = (
  over: Partial<PrismaJson.NetworkPolicyRule> & Pick<PrismaJson.NetworkPolicyRule, 'cidrs'>
): PrismaJson.NetworkPolicyRule => ({
  id: Math.random().toString(36).slice(2),
  effect: 'allow',
  direction: 'egress',
  enabled: true,
  priority: 0,
  ...over
});

describe('internalRanges', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('equals the egress gateway list', () => {
    let vectors = JSON.parse(readFileSync(egressVectorsPath, 'utf8'));
    expect(internalRanges).toEqual(vectors.policy.internalRanges);
  });

  it('covers the embedded-IPv4 prefixes', () => {
    for (let cidr of [
      '64:ff9b::a00:0/104',
      '2002:a00::/24',
      '2001:0:4136::/48',
      '::ffff:0:0/100'
    ]) {
      expect(isInsideInternalRanges(cidr)).toBe(true);
    }
  });

  it('keeps public ranges outside', () => {
    for (let cidr of ['93.184.216.0/24', '0.0.0.0/0', '::/0', '2606:2800::/32', '8.0.0.0/5']) {
      expect(isInsideInternalRanges(cidr)).toBe(false);
    }
  });

  it('warns about internal function egress rules in the cloud', () => {
    vi.stubEnv('METORIAL_EDITION', 'cloud');

    let warnings = functionEgressWarnings({
      rules: [
        rule({ cidrs: ['10.20.0.0/16', '93.184.216.0/24'] }),
        rule({ cidrs: ['10.20.0.0/16', '169.254.169.254/32'] }),
        rule({ cidrs: ['192.168.0.0/16'], effect: 'deny' }),
        rule({ cidrs: ['172.16.0.0/12'], enabled: false }),
        rule({ cidrs: ['fd00::/8'], direction: 'ingress' }),
        rule({ cidrs: ['0.0.0.0/0'] })
      ]
    });

    expect(warnings).toEqual([
      'Allowing 10.20.0.0/16 has no effect in Metorial Cloud: functions can never reach internal or reserved address ranges.',
      'Allowing 169.254.169.254/32 has no effect in Metorial Cloud: functions can never reach internal or reserved address ranges.'
    ]);
  });

  it('does not warn on-prem', () => {
    vi.stubEnv('METORIAL_EDITION', 'on-prem');

    expect(functionEgressWarnings({ rules: [rule({ cidrs: ['10.20.0.0/16'] })] })).toEqual([]);
  });
});
