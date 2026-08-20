export interface SlateProvisionedRouteAuthorityResolver {
  resolve(d: {
    provisionedRouteId: string;
    purpose: 'app_route_path' | 'vendor_verification';
  }): Promise<{
    provisionedRouteId: string;
    routeGeneration: number;
    vendor: string;
    credentialOwnerRef: string;
    purpose: 'app_route_path' | 'vendor_verification';
    secretId: string;
    secretVersion: number;
    status: 'active' | 'inactive' | 'revoked';
    expiresAt: Date | null;
  }>;
}

let provisionedRouteAuthorityResolver: SlateProvisionedRouteAuthorityResolver | null = null;
export let configureSlateProvisionedRouteAuthorityResolver = (
  resolver: SlateProvisionedRouteAuthorityResolver
) => {
  provisionedRouteAuthorityResolver = resolver;
};
export let resolveProvisionedRouteAuthority = async (d: {
  provisionedRouteId: string;
  purpose: 'app_route_path' | 'vendor_verification';
  now: Date;
}) => {
  if (!provisionedRouteAuthorityResolver) {
    throw new Error('Authoritative provisioned route resolver is unavailable');
  }
  let authority = await provisionedRouteAuthorityResolver.resolve(d);
  if (
    authority.provisionedRouteId !== d.provisionedRouteId ||
    authority.purpose !== d.purpose ||
    authority.status !== 'active' ||
    (authority.expiresAt !== null && authority.expiresAt <= d.now) ||
    authority.routeGeneration < 1 ||
    !authority.vendor ||
    !authority.credentialOwnerRef ||
    !authority.secretId ||
    !Number.isInteger(authority.secretVersion) ||
    authority.secretVersion < 1
  ) {
    throw new Error('Authoritative provisioned route binding is inactive or invalid');
  }
  return authority;
};
