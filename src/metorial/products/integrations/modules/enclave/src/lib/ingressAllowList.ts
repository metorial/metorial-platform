import ipaddr from 'ipaddr.js';
import type { CompiledNetworkAllowList } from './compileNetworkAllowList';

export let isIpAllowedByIngressAllowList = (d: {
  sourceIp: string;
  ingressPolicy: CompiledNetworkAllowList | PrismaJson.CompiledNetworkAllowList;
}) => {
  if (d.ingressPolicy.direction !== 'ingress') return false;

  let source;
  try {
    source = ipaddr.process(d.sourceIp);
  } catch {
    return false;
  }

  for (let entry of d.ingressPolicy.entries) {
    try {
      let [range, prefix] = ipaddr.parseCIDR(entry.cidr);
      if (source.kind() !== range.kind()) continue;
      if (source.match(range, prefix)) return true;
    } catch {
      continue;
    }
  }

  return false;
};
