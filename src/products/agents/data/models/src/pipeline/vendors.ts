import { normalizeKey } from '../normalize/parseName';
import {
  vendorKindHints,
  vendorSeeds,
  type EndpointSeed,
  type VendorSeed
} from '../registry/vendors';
import type { ModelsDevSnapshot } from '../sources/modelsDev';
import type { Endpoint, EndpointPlan, Vendor, VendorKind } from '../types';
import type { OrganizationIndex } from './organizations';

let firstPartyShare = 0.5;

export interface ProviderEndpoint {
  vendorId: string;
  endpointId: string;
  slug: string;
}

export interface VendorIndex {
  vendors: Map<string, Vendor>;
  endpoints: Map<string, Endpoint>;
  byProvider: Map<string, ProviderEndpoint>;
  logoSources: Map<string, string>;
  isFirstParty: (vendorId: string, labId: string) => boolean;
}

let inferEndpoint = (providerId: string): EndpointSeed => {
  let plan: EndpointPlan = providerId.includes('coding-plan')
    ? 'coding-plan'
    : providerId.includes('token-plan')
      ? 'token-plan'
      : 'pay-as-you-go';

  let region = /(^|-)cn(-|$)/.test(providerId) ? 'cn' : undefined;
  return { slug: 'default', region, plan };
};

// An unlisted provider whose catalog is mostly its own lab's models is that lab's API.
let looksFirstParty = (
  snapshot: ModelsDevSnapshot,
  providerId: string,
  labUpstreamIds: string[]
) => {
  let models = snapshot.providerModels.filter(model => model.providerId === providerId);
  if (!models.length || !labUpstreamIds.length) return false;

  let own = models.filter(model =>
    labUpstreamIds.some(lab => model.baseModel?.startsWith(`${lab}/`))
  ).length;
  return own / models.length >= firstPartyShare;
};

export let buildVendors = (
  snapshot: ModelsDevSnapshot,
  orgs: OrganizationIndex
): VendorIndex => {
  let vendors = new Map<string, Vendor>();
  let endpoints = new Map<string, Endpoint>();
  let byProvider = new Map<string, ProviderEndpoint>();
  let logoSources = new Map<string, string>();

  let seedByUpstream = new Map<string, VendorSeed>();
  for (let seed of vendorSeeds)
    for (let upstream of Object.keys(seed.upstream)) seedByUpstream.set(upstream, seed);

  let upstreamLabsOf = (orgId: string) =>
    snapshot.labs.map(lab => lab.id).filter(lab => orgs.labForUpstream(lab) === orgId);

  for (let provider of snapshot.providers) {
    let seed = seedByUpstream.get(provider.id);
    let vendorId = seed?.id ?? normalizeKey(provider.id);
    let orgId =
      seed?.organizationId ??
      orgs.resolveOrg(vendorId) ??
      orgs.resolveOrg(provider.id) ??
      vendorId;
    let org = orgs.ensure({ id: orgId, name: seed?.name ?? provider.name, role: 'vendor' });

    let kind: VendorKind =
      seed?.kind ??
      vendorKindHints[provider.id] ??
      (org.roles.includes('lab') &&
      looksFirstParty(snapshot, provider.id, upstreamLabsOf(orgId))
        ? 'first-party'
        : 'inference');

    let vendor = vendors.get(vendorId);
    if (!vendor) {
      vendor = {
        id: vendorId,
        organizationId: orgId,
        name: seed?.name ?? provider.name,
        kind,
        website: org.website,
        docs: provider.doc,
        logo: null,
        endpointIds: [],
        status: 'active'
      };
      vendors.set(vendorId, vendor);
    }

    if (provider.logoPath && !vendor.logo) {
      vendor.logo = `logos/vendors/${vendorId}.svg`;
      logoSources.set(vendor.logo, provider.logoPath);
    }

    let endpointSeed = seed?.upstream[provider.id] ?? inferEndpoint(provider.id);
    let endpointId = `${vendorId}/${endpointSeed.slug}`;
    let endpoint = endpoints.get(endpointId);

    if (!endpoint) {
      endpoint = {
        id: endpointId,
        vendorId,
        name: provider.name,
        region: endpointSeed.region ?? null,
        plan: endpointSeed.plan ?? 'pay-as-you-go',
        baseUrl: provider.api,
        sdk: provider.npm,
        authEnv: provider.env,
        upstreamIds: [],
        status: 'active'
      };
      endpoints.set(endpointId, endpoint);
      vendor.endpointIds = [...vendor.endpointIds, endpointId].sort();
    }

    endpoint.upstreamIds = [...endpoint.upstreamIds, provider.id].sort();
    byProvider.set(provider.id, { vendorId, endpointId, slug: endpointSeed.slug });
  }

  let isFirstParty = (vendorId: string, labId: string) => {
    let vendor = vendors.get(vendorId);
    return !!vendor && vendor.kind === 'first-party' && vendor.organizationId === labId;
  };

  return { vendors, endpoints, byProvider, logoSources, isFirstParty };
};
