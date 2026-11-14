import { describe, expect, it } from 'vitest';
import { intersectEgressAllowLists, resolveGrantEgress } from './egressPolicy';

let allowList = (
  ...entries: PrismaJson.CompiledNetworkAllowEntry[]
): PrismaJson.CompiledEgressNetworkAllowList => ({ direction: 'egress', entries });

describe('intersectEgressAllowLists', () => {
  it('returns the other side when one side is missing', () => {
    let list = allowList({ cidr: '10.0.0.0/8' });

    expect(intersectEgressAllowLists(undefined, undefined)).toBeUndefined();
    expect(intersectEgressAllowLists(list, undefined)).toBe(list);
    expect(intersectEgressAllowLists(undefined, list)).toBe(list);
  });

  it('keeps the narrower CIDR and the overlapping port range', () => {
    expect(
      intersectEgressAllowLists(
        allowList({ cidr: '0.0.0.0/0', portRange: { from: 1, to: 1024 } }, { cidr: '::/0' }),
        allowList(
          { cidr: '93.184.216.0/24', portRange: { from: 443, to: 8443 } },
          { cidr: '2606:2800::/32' }
        )
      )
    ).toEqual(
      allowList(
        { cidr: '93.184.216.0/24', portRange: { from: 443, to: 1024 } },
        { cidr: '2606:2800::/32' }
      )
    );
  });

  it('takes a one-sided port range as is', () => {
    expect(
      intersectEgressAllowLists(
        allowList({ cidr: '10.20.0.0/16' }),
        allowList({ cidr: '10.20.30.0/24', portRange: { from: 443, to: 443 } })
      )
    ).toEqual(allowList({ cidr: '10.20.30.0/24', portRange: { from: 443, to: 443 } }));
  });

  it('denies everything when nothing overlaps', () => {
    let denyAll = allowList({ cidr: '0.0.0.0/32' }, { cidr: '::/128' });

    expect(
      intersectEgressAllowLists(
        allowList({ cidr: '10.0.0.0/8' }),
        allowList({ cidr: '192.168.0.0/16' })
      )
    ).toEqual(denyAll);
    expect(
      intersectEgressAllowLists(
        allowList({ cidr: '10.0.0.0/8', portRange: { from: 80, to: 80 } }),
        allowList({ cidr: '10.1.0.0/16', portRange: { from: 443, to: 443 } })
      )
    ).toEqual(denyAll);
    expect(
      intersectEgressAllowLists(allowList({ cidr: '0.0.0.0/0' }), allowList({ cidr: '::/0' }))
    ).toEqual(denyAll);
  });

  it('handles embedded IPv4 and compressed IPv6 notation', () => {
    expect(
      intersectEgressAllowLists(
        allowList({ cidr: '::ffff:0:0/96' }),
        allowList({ cidr: '::ffff:10.1.2.3/128' })
      )
    ).toEqual(allowList({ cidr: '::ffff:10.1.2.3/128' }));
  });

  it('ignores malformed entries instead of widening the policy', () => {
    expect(
      intersectEgressAllowLists(
        allowList({ cidr: '10.0.0.0/33' }),
        allowList({ cidr: '10.0.0.0/8' })
      )
    ).toEqual(allowList({ cidr: '0.0.0.0/32' }, { cidr: '::/128' }));
  });
});

describe('resolveGrantEgress', () => {
  let configuration = { memorySizeMb: 256, timeoutSeconds: 30 };

  it('omits the policy when neither side restricts egress', () => {
    expect(resolveGrantEgress({ configuration })).toEqual({});
  });

  it('maps disableNetworkIsolation and explicit allowAll to allowAll', () => {
    expect(
      resolveGrantEgress({
        configuration: { ...configuration, disableNetworkIsolation: true },
        egressPolicy: allowList({ cidr: '10.0.0.0/8' })
      })
    ).toEqual({ allowAll: true });
    expect(resolveGrantEgress({ configuration, allowAll: true })).toEqual({ allowAll: true });
  });

  it('intersects the function rules with the invocation policy', () => {
    expect(
      resolveGrantEgress({
        configuration: { ...configuration, egress: allowList({ cidr: '10.0.0.0/8' }) },
        egressPolicy: allowList({ cidr: '10.20.0.0/16', portRange: { from: 443, to: 443 } })
      })
    ).toEqual({
      policy: { entries: [{ cidr: '10.20.0.0/16', portRange: { from: 443, to: 443 } }] }
    });
  });
});
