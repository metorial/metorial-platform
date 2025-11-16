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

export let getPortalHost = (d: { portal: Portal }) => {
  return {
    host: env.portals.PORTAL_HOST_TEMPLATE.replace('{portalId}', d.portal.id),
    isVanityDomain,
    isVanityPath
  };
};
