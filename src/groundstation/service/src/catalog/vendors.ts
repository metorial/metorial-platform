import { normalizeAgentKey } from '@metorial/model-catalog/src/pipeline/agents';
import type { Agent, Catalog } from '@metorial/model-catalog/src/types';
import type { VendorSource } from '../knowledge/types';

// Provider strings the dialects emit (`normalizeProvider`) that match no catalog vendor,
// organization or endpoint id.
let providerAliases = new Map([
  ['vertex', 'google-vertex'],
  ['bedrock', 'aws-bedrock']
]);

export type VendorInfo = { id: string; organizationId: string; kind: string };

export type EndpointInfo = {
  id: string;
  vendorId: string;
  baseUrlHost: string | null;
  upstreamIds: string[];
};

export type AgentInfo = {
  id: string;
  makerId: string;
  aliasKeys: string[];
  defaultVendorId: string | null;
  subscriptionVendorIds: string[];
};

export type VendorChoice = { vendorId: string; vendorSource: VendorSource };

export type VendorDirectory = {
  vendor: (vendorId: string) => VendorInfo | undefined;
  reportedVendor: (provider: string) => string | undefined;
  endpointVendor: (baseUrl: string) => string | undefined;
  agent: (family: string) => AgentInfo | undefined;
  firstPartyVendor: (labId: string) => string | undefined;
};

export let hostOf = (url: string) => {
  let value = url.trim();
  if (!value) return null;

  try {
    return new URL(value.includes('://') ? value : `https://${value}`).host.toLowerCase();
  } catch {
    return null;
  }
};

export let agentInfoOf = (agent: Agent): AgentInfo => ({
  id: agent.id,
  makerId: agent.makerId,
  aliasKeys: [...new Set([agent.id, ...(agent.aliases ?? [])].map(normalizeAgentKey))].sort(),
  defaultVendorId: agent.vendors?.find(vendor => vendor.role == 'default')?.vendorId ?? null,
  subscriptionVendorIds: (agent.vendors ?? [])
    .filter(vendor => vendor.role == 'subscription')
    .map(vendor => vendor.vendorId)
});

export let endpointInfosOf = (catalog: Pick<Catalog, 'endpoints'>): EndpointInfo[] =>
  (catalog.endpoints ?? []).map(endpoint => ({
    id: endpoint.id,
    vendorId: endpoint.vendorId,
    baseUrlHost: endpoint.baseUrl ? hostOf(endpoint.baseUrl) : null,
    upstreamIds: endpoint.upstreamIds ?? []
  }));

let byId = <T extends { id: string }>(items: T[]) =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

let setFirst = (map: Map<string, string>, key: string, value: string) => {
  if (!map.has(key)) map.set(key, value);
};

export let firstPartyVendors = (vendors: VendorInfo[]) => {
  let result = new Map<string, string>();

  for (let vendor of byId(vendors)) {
    if (vendor.kind == 'first-party') setFirst(result, vendor.organizationId, vendor.id);
  }

  return result;
};

// An organization stands for its first-party vendor, or for its only vendor when it has no
// first-party one (GitHub sells only through GitHub Copilot).
let organizationVendors = (vendors: VendorInfo[]) => {
  let firstParty = firstPartyVendors(vendors);
  let all = new Map<string, string[]>();

  for (let vendor of byId(vendors)) {
    all.set(vendor.organizationId, [...(all.get(vendor.organizationId) ?? []), vendor.id]);
  }

  let result = new Map(firstParty);
  for (let [organizationId, ids] of all) {
    if (ids.length == 1) setFirst(result, organizationId, ids[0]!);
  }

  return result;
};

export let createVendorDirectory = (d: {
  vendors: VendorInfo[];
  endpoints: EndpointInfo[];
  agents: AgentInfo[];
}): VendorDirectory => {
  let vendors = new Map(d.vendors.map(vendor => [vendor.id, vendor]));
  let firstParty = firstPartyVendors(d.vendors);
  let organizations = organizationVendors(d.vendors);

  let endpointIds = new Map<string, string>();
  let upstreamIds = new Map<string, string>();
  let hosts = new Map<string, string>();

  for (let endpoint of byId(d.endpoints)) {
    setFirst(endpointIds, endpoint.id.toLowerCase(), endpoint.vendorId);
    for (let id of endpoint.upstreamIds)
      setFirst(upstreamIds, id.toLowerCase(), endpoint.vendorId);
    if (endpoint.baseUrlHost) setFirst(hosts, endpoint.baseUrlHost, endpoint.vendorId);
  }

  let agents = new Map<string, AgentInfo>();
  for (let agent of byId(d.agents)) {
    for (let key of agent.aliasKeys) if (!agents.has(key)) agents.set(key, agent);
  }

  let matchProvider = (provider: string) =>
    (vendors.has(provider) ? provider : undefined) ??
    providerAliases.get(provider) ??
    endpointIds.get(provider) ??
    upstreamIds.get(provider) ??
    organizations.get(provider);

  return {
    vendor: vendorId => vendors.get(vendorId),

    reportedVendor: provider => {
      let lowered = provider
        .trim()
        .toLowerCase()
        .replace(/^other:/, '');
      if (!lowered) return undefined;

      return matchProvider(lowered) ?? matchProvider(lowered.replace(/_/g, '-'));
    },

    endpointVendor: baseUrl => {
      let host = hostOf(baseUrl);
      return host ? hosts.get(host) : undefined;
    },

    agent: family => agents.get(normalizeAgentKey(family)),

    firstPartyVendor: labId => firstParty.get(labId)
  };
};

export let catalogVendorDirectory = (catalog: Catalog) =>
  createVendorDirectory({
    vendors: catalog.vendors ?? [],
    endpoints: endpointInfosOf(catalog),
    agents: (catalog.agents ?? []).map(agentInfoOf)
  });
