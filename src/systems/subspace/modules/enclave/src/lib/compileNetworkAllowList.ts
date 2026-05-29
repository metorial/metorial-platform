import {
  cidrSetEqualsUniverse,
  cidrSetIntersect,
  cidrSetIsEmpty,
  cidrSetSubtract,
  cidrSetUnion,
  emptyCidr,
  splitCidrsByFamily,
  universeCidr,
  type AddressFamily
} from './cidrSet';
import {
  fullPortRange,
  portRangeSetIntersect,
  portRangeSetIsEmpty,
  portRangeSetSubtract,
  portRangeSetUnion,
  type PortRange
} from './portRangeSet';

type NetworkPolicyRule = PrismaJson.NetworkPolicyRule;
type NetworkPolicyRules = PrismaJson.NetworkPolicyRules;

export type CompiledNetworkAllowEntry = {
  cidr: string;
  portRange?: PortRange;
};

export type CompiledNetworkAllowList = {
  direction: 'ingress' | 'egress';
  entries: CompiledNetworkAllowEntry[];
};

type AllowBox = {
  cidrs: string[];
  portRanges: PortRange[];
};

let subtractBoxes = (base: AllowBox[], remove: AllowBox[]) => {
  let result = base;

  for (let removeBox of remove) {
    let next: AllowBox[] = [];

    for (let box of result) {
      let cidrOnly = cidrSetSubtract(box.cidrs, removeBox.cidrs);
      let cidrOverlap = cidrSetIntersect(box.cidrs, removeBox.cidrs);
      let portOnly = portRangeSetSubtract(box.portRanges, removeBox.portRanges);

      if (cidrOnly.length) {
        next.push({ cidrs: cidrOnly, portRanges: box.portRanges });
      }

      if (cidrOverlap.length && portOnly.length) {
        next.push({ cidrs: cidrOverlap, portRanges: portOnly });
      }
    }

    result = next;
  }

  return result;
};

let intersectBoxes = (a: AllowBox[], b: AllowBox[]) => {
  let result: AllowBox[] = [];

  for (let left of a) {
    for (let right of b) {
      let cidrs = cidrSetIntersect(left.cidrs, right.cidrs);
      let portRanges = portRangeSetIntersect(left.portRanges, right.portRanges);

      if (cidrs.length && portRanges.length) {
        result.push({ cidrs, portRanges });
      }
    }
  }

  return result;
};

let addBoxes = (base: AllowBox[], add: AllowBox[]) => {
  let boxes = [...base, ...add];
  return mergeBoxes(boxes);
};

let mergeBoxes = (boxes: AllowBox[]) => {
  let entries: CompiledNetworkAllowEntry[] = [];

  for (let box of boxes) {
    for (let cidr of cidrSetUnion(box.cidrs)) {
      for (let portRange of box.portRanges) {
        entries.push({ cidr, portRange: { ...portRange } });
      }
    }
  }

  return entriesToBoxes(entries);
};

let entriesToBoxes = (entries: CompiledNetworkAllowEntry[]) => {
  let grouped = new Map<string, PortRange[]>();

  for (let entry of entries) {
    let ports = grouped.get(entry.cidr) ?? [];
    ports.push(entry.portRange ?? fullPortRange());
    grouped.set(entry.cidr, ports);
  }

  return [...grouped.entries()].map(([cidr, portRanges]) => ({
    cidrs: [cidr],
    portRanges: portRangeSetUnion(portRanges)
  }));
};

let boxesToEntries = (
  boxes: AllowBox[],
  direction: 'ingress' | 'egress'
): CompiledNetworkAllowEntry[] => {
  let entries: CompiledNetworkAllowEntry[] = [];

  for (let box of boxes) {
    for (let cidr of cidrSetUnion(box.cidrs)) {
      if (direction === 'ingress') {
        entries.push({ cidr });
        continue;
      }

      for (let portRange of box.portRanges) {
        entries.push({ cidr, portRange: { ...portRange } });
      }
    }
  }

  return mergeEntries(entries, direction);
};

let mergeEntries = (entries: CompiledNetworkAllowEntry[], direction: 'ingress' | 'egress') => {
  if (direction === 'ingress') {
    return cidrSetUnion(entries.map(entry => entry.cidr)).map(cidr => ({ cidr }));
  }

  let grouped = new Map<string, PortRange[]>();

  for (let entry of entries) {
    let ports = grouped.get(entry.cidr) ?? [];
    if (entry.portRange) ports.push(entry.portRange);
    grouped.set(entry.cidr, ports);
  }

  return [...grouped.entries()].flatMap(([cidr, portRanges]) =>
    portRangeSetUnion(portRanges).map(portRange => ({ cidr, portRange }))
  );
};

let boxesCoverUniverse = (boxes: AllowBox[], family: AddressFamily) =>
  subtractBoxes(
    [
      {
        cidrs: [universeCidr(family)],
        portRanges: [fullPortRange()]
      }
    ],
    boxes
  ).length === 0;

let normalizeFamilyEntries = (
  entries: CompiledNetworkAllowEntry[],
  family: AddressFamily,
  direction: 'ingress' | 'egress'
) => {
  let familyEntries = entries.filter(entry => splitCidrsByFamily([entry.cidr])[family].length);

  if (familyEntries.length === 0) return [];

  if (direction === 'ingress') {
    let cidrs = cidrSetUnion(familyEntries.map(entry => entry.cidr));

    if (cidrSetIsEmpty(cidrs)) {
      return [{ cidr: emptyCidr(family) }];
    }

    if (cidrSetEqualsUniverse(cidrs, family)) {
      return [{ cidr: universeCidr(family) }];
    }

    return cidrs.map(cidr => ({ cidr }));
  }

  let boxes = entriesToBoxes(familyEntries);
  let cidrs = cidrSetUnion(boxes.flatMap(box => box.cidrs));
  let ports = portRangeSetUnion(boxes.flatMap(box => box.portRanges));

  if (cidrSetIsEmpty(cidrs) || portRangeSetIsEmpty(ports)) {
    return [{ cidr: emptyCidr(family) }];
  }

  if (boxesCoverUniverse(boxes, family)) {
    return [{ cidr: universeCidr(family) }];
  }

  return mergeEntries(
    boxes.flatMap(box =>
      cidrSetUnion(box.cidrs).flatMap(cidr =>
        box.portRanges.map(portRange => ({ cidr, portRange }))
      )
    ),
    'egress'
  );
};

let ruleToBoxes = (rule: NetworkPolicyRule, direction: 'ingress' | 'egress'): AllowBox[] => [
  {
    cidrs: rule.cidrs,
    portRanges:
      direction === 'egress'
        ? rule.ports?.length
          ? rule.ports.map(port => ({ from: port.from, to: port.to }))
          : [fullPortRange()]
        : [fullPortRange()]
  }
];

let initialRemaining = (direction: 'ingress' | 'egress'): AllowBox[] => [
  {
    cidrs: [universeCidr('ipv4'), universeCidr('ipv6')],
    portRanges: [fullPortRange()]
  }
];

let compileRules = (d: { direction: 'ingress' | 'egress'; rules: NetworkPolicyRules }) => {
  let sortedRules = d.rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.enabled && rule.direction === d.direction)
    .sort((a, b) => b.rule.priority - a.rule.priority || a.index - b.index);

  let remaining = initialRemaining(d.direction);
  let allowed: AllowBox[] = [];

  for (let { rule } of sortedRules) {
    let ruleBoxes = ruleToBoxes(rule, d.direction);
    let overlap = intersectBoxes(remaining, ruleBoxes);

    if (overlap.length) {
      if (rule.effect === 'allow') {
        allowed = addBoxes(allowed, overlap);
      }

      remaining = subtractBoxes(remaining, ruleBoxes);
    }
  }

  return boxesToEntries(allowed, d.direction);
};

let emptyFallbackEntries = (): CompiledNetworkAllowEntry[] => [
  { cidr: emptyCidr('ipv4') },
  { cidr: emptyCidr('ipv6') }
];

export let compileNetworkAllowList = (d: {
  direction: 'ingress' | 'egress';
  rules: NetworkPolicyRules;
}): CompiledNetworkAllowList => {
  let compiled = compileRules(d);

  if (compiled.length === 0) {
    return {
      direction: d.direction,
      entries: emptyFallbackEntries()
    };
  }

  let ipv4Entries = normalizeFamilyEntries(compiled, 'ipv4', d.direction);
  let ipv6Entries = normalizeFamilyEntries(compiled, 'ipv6', d.direction);

  let entries = [...ipv4Entries, ...ipv6Entries];

  if (entries.length === 0) {
    return {
      direction: d.direction,
      entries: emptyFallbackEntries()
    };
  }

  return {
    direction: d.direction,
    entries
  };
};
