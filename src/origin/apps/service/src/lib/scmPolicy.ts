import { badRequestError, createError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { checkEdition } from '@metorial/editions';
import { defineSettings, setting, SettingsValidationError } from '@metorial/settings';
import type { ScmBackend, ScmBackendType } from '../../prisma/generated/client';

export let scmProviderTypes = [
  'github',
  'github_enterprise',
  'gitlab',
  'gitlab_selfhosted',
  'bitbucket',
  'bitbucket_data_center'
] as const;

export let hostedProviderUrls = {
  github: { webUrl: 'https://github.com', apiUrl: 'https://api.github.com' },
  gitlab: { webUrl: 'https://gitlab.com', apiUrl: 'https://gitlab.com/api/v4' },
  bitbucket: { webUrl: 'https://bitbucket.org', apiUrl: 'https://api.bitbucket.org/2.0' }
};

export let scmSetupTypes: readonly [ScmBackendType, ...ScmBackendType[]] = checkEdition(
  'on-prem'
)
  ? scmProviderTypes
  : (['github_enterprise', 'gitlab_selfhosted', 'bitbucket_data_center'] as const);

let policy = defineSettings('originScm', {
  types: setting.list(v.enumOf([...scmProviderTypes]), {
    env: 'ORIGIN_SCM_ALLOWED_PROVIDER_TYPES',
    editions: ['on-prem'],
    default: [...scmProviderTypes],
    description:
      'SCM provider types available on this installation; an empty list disables all providers'
  }),
  domains: {
    ...setting.list(v.string(), {
      env: 'ORIGIN_SCM_ALLOWED_DOMAINS',
      editions: ['on-prem'],
      description:
        'Exact provider hostnames; unset allows any domain and an empty list allows none'
    }),
    validator: v.optional(v.array(v.string()))
  }
});

let providerLabels: Record<ScmBackendType, string> = {
  github: 'GitHub.com',
  github_enterprise: 'GitHub Enterprise',
  gitlab: 'GitLab.com',
  gitlab_selfhosted: 'GitLab Self-Managed',
  bitbucket: 'Bitbucket Cloud',
  bitbucket_data_center: 'Bitbucket Data Center'
};

export let normalizeScmDomain = (value: string) => {
  let trimmed = value.trim().replace(/\.$/, '');
  if (!trimmed || /[\s/:@?#*\\]/.test(trimmed))
    throw new Error('Expected an exact hostname without a scheme, port, path or wildcard');

  let hostname = new URL(`https://${trimmed}`).hostname.toLowerCase().replace(/\.$/, '');
  if (
    !hostname ||
    hostname.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
  )
    throw new Error('Invalid hostname');

  return hostname;
};

let allowedDomains = policy.domains?.map(value => {
  try {
    return normalizeScmDomain(value);
  } catch (error) {
    throw new SettingsValidationError([
      {
        group: 'originScm',
        key: 'domains',
        env: 'ORIGIN_SCM_ALLOWED_DOMAINS',
        audience: 'deployment',
        message: (error as Error).message
      }
    ]);
  }
});

export class ScmPolicyError extends ServiceError<
  ReturnType<typeof createError<'scm_policy_denied', 403>>
> {
  constructor(message: string) {
    super(createError({ code: 'scm_policy_denied', status: 403, message }));
    // BullMQ also recognizes this name across bundled copies of its error classes.
    this.name = 'UnrecoverableError';
  }
}

export let assertScmTypeAllowed = (type: ScmBackendType) => {
  if (checkEdition('on-prem') && !policy.types?.includes(type))
    throw new ScmPolicyError(
      'This source control provider is disabled by the installation policy.'
    );
};

let validUrl = (value: string) => {
  let url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid provider URL');
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  return url;
};

export let assertScmBackendAllowed = (
  backend?: Pick<ScmBackend, 'type' | 'webUrl' | 'apiUrl' | 'isDefault' | 'tenantOid'>
) => {
  if (checkEdition('cloud')) return;
  if (!backend || backend.isDefault || backend.tenantOid === null)
    throw new ScmPolicyError(
      'Configure a source control provider in the dashboard before connecting.'
    );
  assertScmTypeAllowed(backend.type);

  try {
    let web = validUrl(backend.webUrl);
    let api = validUrl(backend.apiUrl);
    let hosted = hostedProviderUrls[backend.type as keyof typeof hostedProviderUrls];
    if (
      hosted &&
      (web.toString().replace(/\/$/, '') !== hosted.webUrl ||
        api.toString().replace(/\/$/, '') !== hosted.apiUrl)
    )
      throw new Error('Hosted providers must use their official URLs');
    let hosts = hosted ? [web.hostname] : [web.hostname, api.hostname];
    if (allowedDomains && hosts.some(host => !allowedDomains.includes(host)))
      throw new Error('The provider domain is not allowed by the installation policy');
  } catch (error) {
    throw new ScmPolicyError((error as Error).message);
  }
};

export let isScmBackendAllowed = (backend: Parameters<typeof assertScmBackendAllowed>[0]) => {
  try {
    assertScmBackendAllowed(backend);
    return true;
  } catch {
    return false;
  }
};

export let getScmProviderOptions = () =>
  scmSetupTypes
    .filter(type => {
      if (checkEdition('cloud')) return true;
      if (!policy.types?.includes(type)) return false;
      let hosted = hostedProviderUrls[type as keyof typeof hostedProviderUrls];
      return (
        !allowedDomains ||
        (hosted
          ? allowedDomains.includes(new URL(hosted.webUrl).hostname)
          : allowedDomains.length > 0)
      );
    })
    .map(type => ({
      type,
      label: providerLabels[type],
      allowedDomains: allowedDomains ?? null
    }));

export let normalizeScmBackendUrls = (type: ScmBackendType, baseUrl: string) => {
  let hosted = hostedProviderUrls[type as keyof typeof hostedProviderUrls];
  if (hosted) return hosted;

  let url: URL;
  try {
    url = validUrl(baseUrl);
  } catch {
    throw new ServiceError(
      badRequestError({
        message:
          'Enter a valid HTTP or HTTPS provider base URL without credentials, query parameters or a fragment.'
      })
    );
  }
  url.pathname = url.pathname
    .replace(
      type === 'github_enterprise'
        ? /\/api\/v3\/?$/
        : type === 'gitlab_selfhosted'
          ? /\/api\/v4\/?$/
          : /\/rest\/api\/(?:1\.0|latest)\/?$/,
      ''
    )
    .replace(/\/+$/, '');
  let webUrl = url.toString().replace(/\/$/, '');
  let suffix =
    type === 'github_enterprise'
      ? '/api/v3'
      : type === 'gitlab_selfhosted'
        ? '/api/v4'
        : '/rest/api/1.0';

  return { webUrl, apiUrl: `${webUrl}${suffix}` };
};

export let getAllowedScmBackendIds = async (tenantOid: bigint) => {
  if (checkEdition('cloud')) return undefined;

  let { db } = await import('../db');
  let backends = await db.scmBackend.findMany({ where: { tenantOid } });
  return backends.filter(isScmBackendAllowed).map(backend => backend.oid);
};
