import { Portal } from '@metorial/db';
import { portalService } from '@metorial/module-portal';

let cache = new WeakMap<Portal, Promise<string>>();

export let getCachedPortalConnectUrl = (portal: Portal) => {
  let cached = cache.get(portal);
  if (cached) return cached;

  let url = portalService.getPrimaryPortalConnectUrl({ portal });
  cache.set(portal, url);

  return url;
};
