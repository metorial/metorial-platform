export type NetworkRuleInput = {
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  enabled: boolean;
  priority: number;
  description?: string;
  ports?: { from: number; to: number }[];
};

export type RuleValues = {
  effect: NetworkRuleInput['effect'];
  direction: NetworkRuleInput['direction'];
  addressMode: 'specific' | 'any';
  addressFamily: 'ipv4' | 'ipv6' | 'both';
  addresses: string;
  portMode: 'all' | 'specific';
  ports: string;
  priority: string;
  description: string;
  enabled: boolean;
};

let ipv4Pattern = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

let isIPv6 = (address: string) => {
  if (!address.includes(':')) return false;

  let normalized = address;
  if (address.includes('.')) {
    let lastColon = address.lastIndexOf(':');
    if (!ipv4Pattern.test(address.slice(lastColon + 1))) return false;
    normalized = `${address.slice(0, lastColon)}:0:0`;
  }

  let parts = normalized.split('::');
  if (parts.length > 2) return false;

  let segments = parts.flatMap(part => (part ? part.split(':') : []));
  if (!segments.every(segment => /^[0-9a-fA-F]{1,4}$/.test(segment))) return false;

  return parts.length === 2 ? segments.length < 8 : segments.length === 8;
};

export let parseAddresses = (input: string): string[] => {
  let entries = input.split(',').map(entry => entry.trim());
  if (!entries.length || entries.some(entry => !entry))
    throw new Error('Enter IP addresses or CIDRs separated by commas.');

  return entries.map(entry => {
    let parts = entry.split('/');
    let [address, prefix] = parts;
    let maxPrefix = ipv4Pattern.test(address) ? 32 : isIPv6(address) ? 128 : null;

    if (
      maxPrefix === null ||
      parts.length > 2 ||
      (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > maxPrefix))
    ) {
      throw new Error(`Invalid IP address or CIDR: ${entry}`);
    }

    return `${address}/${prefix ?? maxPrefix}`;
  });
};

export let parseRulePorts = (input: string): { from: number; to: number }[] =>
  input.split(',').map(entry => {
    let match = entry.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    let from = Number(match?.[1]);
    let to = Number(match?.[2] ?? match?.[1]);

    if (!match || from < 1 || to > 65535 || from > to)
      throw new Error('Enter ports from 1 to 65535, such as 443, 8000-9000.');

    return { from, to };
  });

export let toRuleInput = (values: RuleValues): NetworkRuleInput => {
  let priority = Number(values.priority);
  if (!values.priority.trim() || !Number.isSafeInteger(priority) || priority < 0)
    throw new Error('Priority must be a whole number, 0 or higher.');

  return {
    effect: values.effect,
    direction: values.direction,
    cidrs:
      values.addressMode === 'specific'
        ? parseAddresses(values.addresses)
        : values.addressFamily === 'both'
          ? ['0.0.0.0/0', '::/0']
          : [values.addressFamily === 'ipv4' ? '0.0.0.0/0' : '::/0'],
    enabled: values.enabled,
    priority,
    description: values.description || undefined,
    ports:
      values.direction === 'egress' && values.portMode === 'specific'
        ? parseRulePorts(values.ports)
        : undefined
  };
};

export let ruleValues = (
  rule?: Omit<NetworkRuleInput, 'description' | 'ports'> & {
    description?: string | null;
    ports?: { from: number; to: number }[] | null;
  },
  priority = 100
): RuleValues => ({
  effect: rule?.effect ?? 'allow',
  direction: rule?.direction ?? 'egress',
  addressMode: 'specific',
  addressFamily: 'both',
  addresses: rule?.cidrs.join(', ') ?? '',
  portMode: rule?.ports?.length ? 'specific' : 'all',
  ports:
    rule?.ports
      ?.map(port => (port.from === port.to ? String(port.from) : `${port.from}-${port.to}`))
      .join(', ') ?? '',
  priority: String(rule?.priority ?? priority),
  description: rule?.description ?? '',
  enabled: rule?.enabled ?? true
});

export let summarizeRule = (rule: Pick<NetworkRuleInput, 'direction' | 'cidrs' | 'ports'>) => {
  let addresses = rule.cidrs
    .map(cidr =>
      cidr === '0.0.0.0/0' ? 'any IPv4 address' : cidr === '::/0' ? 'any IPv6 address' : cidr
    )
    .join(', ');
  let traffic = rule.direction === 'egress' ? 'Outgoing traffic to' : 'Incoming traffic from';
  let ports = rule.ports?.length
    ? `Ports ${rule.ports.map(port => (port.from === port.to ? port.from : `${port.from}-${port.to}`)).join(', ')}`
    : 'All ports';

  return `${traffic} ${addresses}${rule.direction === 'egress' ? ` · ${ports}` : ''}`;
};

export let nextRulePriority = (rules: { priority: number }[]) =>
  rules.length ? Math.max(...rules.map(rule => rule.priority)) + 1 : 100;

export let sortRules = <T extends { priority: number }>(rules: T[]): T[] =>
  rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => b.rule.priority - a.rule.priority || a.index - b.index)
    .map(({ rule }) => rule);

export let movePolicyRule = <T extends { id: string; priority: number }>(
  rules: T[],
  ruleId: string,
  offset: -1 | 1
): T[] => {
  let ordered = sortRules(rules);
  let index = ordered.findIndex(rule => rule.id === ruleId);
  let targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return ordered;

  let priorities = ordered.map(rule => rule.priority);
  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];

  return ordered.map((rule, position) => ({ ...rule, priority: priorities[position] }));
};

export let policyRuleInput = (
  rule: Omit<NetworkRuleInput, 'ports' | 'description'> & {
    ports?: { from: number; to: number }[] | null;
    description?: string | null;
  }
): NetworkRuleInput => ({
  effect: rule.effect,
  direction: rule.direction,
  cidrs: rule.cidrs,
  enabled: rule.enabled,
  priority: rule.priority,
  description: rule.description ?? undefined,
  ports: rule.direction === 'egress' ? (rule.ports ?? undefined) : undefined
});
