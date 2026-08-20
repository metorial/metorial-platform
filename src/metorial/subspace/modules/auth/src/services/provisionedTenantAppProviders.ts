import { env } from '../env';
import { createClient } from '@lowerdeck/rpc-client';
import {
  configureGithubManifestProvisioner,
  configureProvisionedByoCredentialSecretAuthorityResolver,
  configureProvisionedExternalOwnershipVerifier,
  type GithubManifestProvisioner,
  type ProvisionedByoCredentialSecretAuthorityResolver,
  type ProvisionedExternalOwnershipVerifier,
  type VerifiedProvisionedExternalOwnership
} from './provisionedTenantApp';

let slatesHubSubspaceSecretKeyIdHeader = 'metorial-subspace-secret-key-id';

export class ProvisionedAppHubCredentialAuthorityAdapter implements ProvisionedByoCredentialSecretAuthorityResolver {
  private readonly client: {
    validateProvisionedTenantCredentialSecret(
      d: Parameters<ProvisionedByoCredentialSecretAuthorityResolver['validate']>[0]
    ): Promise<{ valid: true }>;
    createOrRotateProvisionedTenantCredentialSecret(d: {
      provisionedTenantAppId: string;
      importedValue: string;
    }): ReturnType<ProvisionedByoCredentialSecretAuthorityResolver['createOrRotate']>;
    revokeProvisionedTenantCredentialSecret(d: {
      provisionedTenantAppId: string;
    }): ReturnType<ProvisionedByoCredentialSecretAuthorityResolver['revoke']>;
  };

  constructor(
    d: { endpoint: string; token: string },
    clientOverride?: ProvisionedAppHubCredentialAuthorityAdapter['client']
  ) {
    if (!d.endpoint || !d.token) {
      throw new Error('Authenticated Hub credential authority configuration is incomplete');
    }
    this.client =
      clientOverride ??
      createClient<typeof this.client>({
        endpoint: d.endpoint,
        getHeaders: () => ({ [slatesHubSubspaceSecretKeyIdHeader]: 'current' }),
        getSignatureToken: () => d.token,
        timeoutMs: 15_000
      });
  }

  async validate(
    d: Parameters<ProvisionedByoCredentialSecretAuthorityResolver['validate']>[0]
  ) {
    return await this.client.validateProvisionedTenantCredentialSecret(d);
  }

  async createOrRotate(
    d: Parameters<ProvisionedByoCredentialSecretAuthorityResolver['createOrRotate']>[0]
  ) {
    return await this.client.createOrRotateProvisionedTenantCredentialSecret(d);
  }

  async revoke(d: Parameters<ProvisionedByoCredentialSecretAuthorityResolver['revoke']>[0]) {
    return await this.client.revokeProvisionedTenantCredentialSecret(d);
  }
}

type VendorServiceFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

let requireString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Provisioned vendor response is missing ${field}`);
  }
  return value;
};

let optionalString = (value: unknown, field: string) => {
  if (value === undefined || value === null) return undefined;
  return requireString(value, field);
};

let readOwnership = (value: unknown): VerifiedProvisionedExternalOwnership => {
  if (!value || typeof value !== 'object') {
    throw new Error('Provisioned vendor ownership response is invalid');
  }
  let response = value as Record<string, unknown>;
  return {
    externalAppId: optionalString(response.externalAppId, 'externalAppId'),
    externalAccountId: optionalString(response.externalAccountId, 'externalAccountId'),
    externalInstallationId: optionalString(
      response.externalInstallationId,
      'externalInstallationId'
    ),
    ownerIdentity: optionalString(response.ownerIdentity, 'ownerIdentity')
  };
};

export class ProvisionedAppVendorServiceAdapter
  implements ProvisionedExternalOwnershipVerifier, GithubManifestProvisioner
{
  private readonly baseUrl: URL;
  private readonly redirectUrl: URL;

  constructor(
    d: {
      baseUrl: string;
      token: string;
      githubManifestRedirectUrl: string;
    },
    private readonly httpFetch: VendorServiceFetch = fetch
  ) {
    this.baseUrl = new URL(d.baseUrl);
    this.redirectUrl = new URL(d.githubManifestRedirectUrl);
    if (!d.token) throw new Error('Provisioned vendor service token is required');
    if (this.redirectUrl.protocol !== 'https:' || this.redirectUrl.hostname !== 'github.com') {
      throw new Error('GitHub manifest redirect must use https://github.com');
    }
    this.token = d.token;
  }

  private readonly token: string;

  private async post(path: string, body: Record<string, unknown>) {
    let response = await this.httpFetch(new URL(path, this.baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`Provisioned vendor service rejected ${path}: ${response.status}`);
    }
    return await response.json();
  }

  getManifestRedirectUrl(d: { state: string; provisionedTenantAppId: string }) {
    let redirect = new URL(this.redirectUrl);
    redirect.searchParams.set('state', d.state);
    redirect.searchParams.set('binding_id', d.provisionedTenantAppId);
    return redirect.toString();
  }

  async verify(d: {
    vendor: string;
    proof: Record<string, unknown>;
    expectedAppId?: string | null;
  }) {
    let response = await this.post('/v1/external-ownership/verify', d);
    return readOwnership(response);
  }

  async exchangeManifestCode(d: {
    code: string;
    state: string;
    provisionedTenantAppId: string;
  }) {
    let response = (await this.post('/v1/github/manifests/exchange', d)) as Record<
      string,
      unknown
    >;
    return {
      externalAppId: requireString(response.externalAppId, 'externalAppId'),
      ownerIdentity: requireString(response.ownerIdentity, 'ownerIdentity')
    };
  }

  async resolveInstallation(d: { installationCode: string; expectedAppId: string }) {
    let response = await this.post('/v1/github/installations/resolve', d);
    let ownership = readOwnership(response);
    return {
      externalAppId: requireString(ownership.externalAppId, 'externalAppId'),
      externalInstallationId: requireString(
        ownership.externalInstallationId,
        'externalInstallationId'
      ),
      externalAccountId: ownership.externalAccountId,
      ownerIdentity: requireString(ownership.ownerIdentity, 'ownerIdentity')
    };
  }
}

export let configureProvisionedTenantAppProductionAdapters = () => {
  let hubEndpoint = env.service.SLATES_HUB_SECRET_RPC_URL;
  let hubToken = env.service.SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_CURRENT;
  if (Boolean(hubEndpoint) !== Boolean(hubToken)) {
    throw new Error('Authenticated Hub credential authority configuration is incomplete');
  }
  configureProvisionedByoCredentialSecretAuthorityResolver(
    hubEndpoint && hubToken
      ? new ProvisionedAppHubCredentialAuthorityAdapter({
          endpoint: hubEndpoint,
          token: hubToken
        })
      : null
  );

  let baseUrl = env.service.PROVISIONED_APP_VENDOR_SERVICE_URL;
  let token = env.service.PROVISIONED_APP_VENDOR_SERVICE_TOKEN;
  let redirectUrl = env.service.GITHUB_MANIFEST_REDIRECT_URL;
  if (!baseUrl && !token && !redirectUrl) {
    configureProvisionedExternalOwnershipVerifier(null);
    configureGithubManifestProvisioner(null);
    return { vendorConfigured: false as const, hubConfigured: Boolean(hubEndpoint) };
  }
  if (!baseUrl || !token || !redirectUrl) {
    throw new Error('Provisioned vendor service configuration is incomplete');
  }
  let adapter = new ProvisionedAppVendorServiceAdapter({
    baseUrl,
    token,
    githubManifestRedirectUrl: redirectUrl
  });
  configureProvisionedExternalOwnershipVerifier(adapter);
  configureGithubManifestProvisioner(adapter);
  return { vendorConfigured: true as const, hubConfigured: Boolean(hubEndpoint) };
};
