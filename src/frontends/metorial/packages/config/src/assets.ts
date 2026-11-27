import { checkEdition, perEdition } from '@metorial/editions';
import { runtimeEnv } from './runtime';

let avatarHosts = new Set(['avatar-cdn.metorial.com', 'avatar.metorial-cdn.com']);
let faviconOrigin = 'https://favicons.metorial-cdn.com';
let imageHosts = new Set([
  ...avatarHosts,
  new URL(faviconOrigin).hostname,
  'cdn.metorial.com'
]);
let directHosts = new Set(['provider-logos.metorial-cdn.com']);
let metorialLogo =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path d="M28.12 0L50 44.24L44 56L28.12 21L11.88 56L6 44.24L28.12 0Z" fill="#0099FF"/></svg>'
  );

export let getAvatarUrl = (id: string | null | undefined) => {
  let base = runtimeEnv(
    'VITE_AVATAR_BASE_URL',
    perEdition({ cloud: 'https://avatar-cdn.metorial.com', 'on-prem': '/assets/avatars' })
  )!;

  return `${base.replace(/\/+$/, '')}/${encodeURIComponent(id ?? 'unknown')}`;
};

export let isGeneratedAvatarUrl = (value: string | null | undefined) => {
  if (!value) return false;
  if (value.startsWith('/assets/avatars/')) return true;

  try {
    let url = new URL(value);
    return avatarHosts.has(url.hostname) || url.pathname.startsWith('/assets/avatars/');
  } catch {
    return false;
  }
};

let proxyExternalImage = (value: string, url: URL) => {
  let base = runtimeEnv('VITE_CAMO_BASE_URL');
  if (!base || (url.protocol != 'http:' && url.protocol != 'https:')) return value;

  let proxy: URL;
  try {
    proxy = new URL(base, typeof location == 'undefined' ? undefined : location.href);
  } catch {
    return value;
  }

  if (url.origin == proxy.origin) return value;
  if (directHosts.has(url.hostname)) return value;

  proxy.search = '';
  proxy.searchParams.set('url', value);
  return proxy.toString();
};

export let resolveImageUrl = <T extends string | null | undefined>(value: T): T => {
  if (!value || !checkEdition('on-prem')) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

  if (url.origin == faviconOrigin) return value;
  if (!imageHosts.has(url.hostname)) return proxyExternalImage(value, url) as T;
  if (avatarHosts.has(url.hostname) && /^[A-Za-z0-9_-]{1,128}$/.test(url.pathname.slice(1))) {
    return getAvatarUrl(url.pathname.slice(1)) as T;
  }

  if (url.hostname == 'cdn.metorial.com' && url.pathname.includes('/logos/metorial/')) {
    return metorialLogo as T;
  }

  let seed = 2166136261;
  for (let char of value as string) {
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  }

  return getAvatarUrl(`image_${seed}`) as T;
};

export let getMetorialLogoUrl = () =>
  perEdition({
    cloud: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg',
    'on-prem': metorialLogo
  });

export let getProviderLogoUrl = (name: string) =>
  resolveImageUrl(`https://provider-logos.metorial-cdn.com/${name}`);

export let getFaviconUrl = (origin: string) =>
  resolveImageUrl(`${faviconOrigin}/?url=${encodeURIComponent(origin)}`);
