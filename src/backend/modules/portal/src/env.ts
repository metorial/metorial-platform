import { Portal } from '@metorial/db';
import { createValidatedEnv } from '@metorial/env';
import { v } from '@metorial/validation';

export let env = createValidatedEnv({
  portals: {
    PORTAL_HOST_TEMPLATE: v.string()
  }
});

if (!env.portals.PORTAL_HOST_TEMPLATE.includes('{portalId}')) {
  throw new Error('PORTAL_HOST_TEMPLATE must include {portalId} placeholder');
}

let parsedTemplate = new URL(env.portals.PORTAL_HOST_TEMPLATE);
let isVanityDomain = parsedTemplate.hostname.includes('{portalId}');
let isVanityPath = !isVanityDomain;

let templateRegex = new RegExp(
  '^' +
    env.portals.PORTAL_HOST_TEMPLATE.replace(/\./g, '\\.')
      .replace(/\//g, '\\/')
      .replace('{portalId}', '([^\\/]+)')
);

export let getPortalHost = (d: { portal: Portal }) => {
  return {
    host: env.portals.PORTAL_HOST_TEMPLATE.replace('{portalId}', d.portal.slug),
    isVanityDomain,
    isVanityPath
  };
};

export let parsePortalIdFromHost = ({ url: rawUrl }: { url: string }) => {
  let parsedUrl = new URL(rawUrl);
  parsedUrl.search = '';
  parsedUrl.hash = '';

  let parsedUrlString = parsedUrl.toString();

  let match = parsedUrlString.match(templateRegex);
  if (!match) return undefined;

  let portalId = match[1];
  let portalUrl = env.portals.PORTAL_HOST_TEMPLATE.replace('{portalId}', portalId).replace(
    /\/+$/,
    ''
  );
  while (portalUrl.endsWith('/')) {
    portalUrl = portalUrl.slice(0, -1);
  }

  let extraPath = parsedUrlString.replace(portalUrl, '');

  return {
    portalId,
    extraPath,
    portalUrl
  };
};
