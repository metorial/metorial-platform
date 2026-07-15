import type {
  SsoImportedDelegation,
  SsoExportedDelegation,
  RemoteAresInstance
} from '../../../prisma/generated/client';
import { getEffectiveDelegationTokenUrl } from '../../lib/ssoDelegationProtocol';
import { aresPorts } from '../../ports';
import type {
  DelegationDescriptor,
  DelegationSnapshot
} from './delegation';

export class DelegationNotFoundError extends Error {}
export class DelegationRemoteError extends Error {}

type ImportedWithRemote = SsoImportedDelegation & {
  remoteInstance: RemoteAresInstance;
  localExportedDelegation?: SsoExportedDelegation | null;
};

let localSsoUrl = `http://localhost:${aresPorts.sso}`;

let isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

let assertSnapshot = (value: unknown): DelegationSnapshot => {
  if (
    !isRecord(value) ||
    value.active !== true ||
    (value.type !== 'metadata' && value.type !== 'identity') ||
    !isRecord(value.delegation) ||
    typeof value.delegation.id !== 'string' ||
    typeof value.delegation.clientId !== 'string' ||
    !isRecord(value.instance) ||
    typeof value.instance.id !== 'string' ||
    typeof value.instance.authorizationUrl !== 'string' ||
    typeof value.instance.tokenUrl !== 'string' ||
    !isRecord(value.tenant) ||
    typeof value.tenant.id !== 'string' ||
    typeof value.tenant.name !== 'string' ||
    value.tenant.status !== 'completed' ||
    typeof value.tenant.hideInUI !== 'boolean' ||
    !Array.isArray(value.connections)
  ) {
    throw new DelegationRemoteError('Delegation returned an invalid snapshot');
  }
  for (let connection of value.connections) {
    if (
      !isRecord(connection) ||
      typeof connection.id !== 'string' ||
      (connection.status !== 'active' && connection.status !== 'disabled') ||
      (connection.providerType !== 'saml' && connection.providerType !== 'oidc') ||
      typeof connection.name !== 'string'
    ) {
      throw new DelegationRemoteError('Delegation returned an invalid connection');
    }
  }
  if (value.type === 'identity') {
    if (
      !isRecord(value.connection) ||
      !isRecord(value.userProfile) ||
      typeof value.userProfile.email !== 'string' ||
      typeof value.userProfile.uid !== 'string' ||
      typeof value.userProfile.uidHash !== 'string' ||
      typeof value.userProfile.firstName !== 'string' ||
      typeof value.userProfile.lastName !== 'string' ||
      !Array.isArray(value.userProfile.roles) ||
      !Array.isArray(value.userProfile.groups)
    ) {
      throw new DelegationRemoteError('Delegation returned an invalid identity');
    }
  }
  return value as DelegationSnapshot;
};

let effectiveTokenUrl = (imported: ImportedWithRemote) => {
  return getEffectiveDelegationTokenUrl({
    tokenUrl: imported.remoteInstance.tokenUrl,
    isSelfDelegation: !!imported.localExportedDelegation,
    localBaseUrl: localSsoUrl
  });
};

let requestToken = async (d: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  body: URLSearchParams;
}) => {
  let response = await fetch(d.tokenUrl, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${d.clientId}:${d.clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: d.body,
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status === 404 || response.status === 401) {
    throw new DelegationNotFoundError('Delegation no longer exists');
  }
  if (!response.ok) {
    let details = (await response.text()).slice(0, 500);
    throw new DelegationRemoteError(
      `Delegation endpoint returned ${response.status}: ${details}`
    );
  }
  let payload = await response.text();
  try {
    return JSON.parse(payload);
  } catch {
    throw new DelegationRemoteError('Delegation returned invalid JSON');
  }
};

let introspect = async (d: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  token: string;
}) => {
  let result = await requestToken({
    ...d,
    body: new URLSearchParams({ token: d.token })
  });
  if (!result?.active) {
    throw new DelegationNotFoundError('Delegation token is inactive');
  }
  return assertSnapshot(result);
};

let getAccessToken = (result: any) => {
  if (typeof result?.access_token !== 'string' || !result.access_token) {
    throw new DelegationRemoteError('Delegation returned an invalid token response');
  }
  return result.access_token;
};

export let ssoDelegationClient = {
  async getMetadataFromDescriptor(
    descriptor: DelegationDescriptor,
    opts: { isSelfDelegation: boolean }
  ) {
    let tokenUrl = getEffectiveDelegationTokenUrl({
      tokenUrl: descriptor.instance.tokenUrl,
      isSelfDelegation: opts.isSelfDelegation,
      localBaseUrl: localSsoUrl
    });
    let tokenResult = await requestToken({
      tokenUrl,
      clientId: descriptor.clientId,
      clientSecret: descriptor.clientSecret,
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'urn:metorial.com:ares:sso-delegation:metadata'
      })
    });
    return await introspect({
      tokenUrl,
      clientId: descriptor.clientId,
      clientSecret: descriptor.clientSecret,
      token: getAccessToken(tokenResult)
    });
  },

  async getMetadata(imported: ImportedWithRemote) {
    let tokenUrl = effectiveTokenUrl(imported);
    let tokenResult = await requestToken({
      tokenUrl,
      clientId: imported.clientId,
      clientSecret: imported.clientSecret,
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'urn:metorial.com:ares:sso-delegation:metadata'
      })
    });
    return await introspect({
      tokenUrl,
      clientId: imported.clientId,
      clientSecret: imported.clientSecret,
      token: getAccessToken(tokenResult)
    });
  },

  async exchangeCode(d: {
    imported: ImportedWithRemote;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }) {
    let tokenUrl = effectiveTokenUrl(d.imported);
    let tokenResult = await requestToken({
      tokenUrl,
      clientId: d.imported.clientId,
      clientSecret: d.imported.clientSecret,
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: d.code,
        redirect_uri: d.redirectUri,
        code_verifier: d.codeVerifier
      })
    });
    return await introspect({
      tokenUrl,
      clientId: d.imported.clientId,
      clientSecret: d.imported.clientSecret,
      token: getAccessToken(tokenResult)
    });
  }
};
