import { checkEdition } from '@metorial/editions';
import { cidrSetSubtract } from '@lowerdeck/ip-range';

// Mirrored by the egress gateway (products/runtime/packages/egress/policy InternalRanges);
// the vectors in packages/egress/testdata keep both lists equal.
export let internalRanges = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '::/96',
  'ff00::/8',
  'fe80::/10',
  'fc00::/7',
  'fec0::/10',
  '2001:db8::/32',
  '100::/64',
  '64:ff9b:1::/48',
  '::ffff:0:0/96',
  '64:ff9b::/96',
  '2002::/16',
  '2001::/32'
];

export let isInsideInternalRanges = (cidr: string) =>
  cidrSetSubtract([cidr], internalRanges).length === 0;

export let functionEgressWarnings = (d: {
  rules: PrismaJson.NetworkPolicyRules;
}): string[] => {
  if (!checkEdition('cloud')) return [];

  let cidrs = d.rules
    .filter(rule => rule.enabled && rule.direction === 'egress' && rule.effect === 'allow')
    .flatMap(rule => rule.cidrs);

  return [...new Set(cidrs)]
    .filter(isInsideInternalRanges)
    .map(
      cidr =>
        `Allowing ${cidr} has no effect in Metorial Cloud: functions can never reach internal or reserved address ranges.`
    );
};
