import { getConfig } from '@metorial/config';
import { Portal } from '@metorial/db';
import {
  namespaceService,
  type NamespacePropertyWithNamespace
} from '@metorial/module-organization';
import { env } from './env';
import { buildPortalUrlFromTemplate, parsePortalIdFromTemplate } from './portalUrlTemplate';

let toOrigin = (value: string | null | undefined) => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

let buildPortalUrlFromId = (portalId: string) => {
  return buildPortalUrlFromTemplate(env.portal.PORTAL_HOST_TEMPLATE, portalId);
};

export let getPortalHost = (d: { portal: Pick<Portal, 'slug'> }) => {
  return {
    host: buildPortalUrlFromId(d.portal.slug)
  };
};

export let getPortalUrls = (d: {
  portal: Pick<Portal, 'slug'>;
  namespaces: NamespacePropertyWithNamespace[];
}) => {
  let urls: { type: 'default' | 'namespace'; url: string }[] = [];
  let seen = new Set<string>();

  let add = (type: 'default' | 'namespace', url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    urls.push({ type, url });
  };

  if (getConfig().env == 'development') {
    add('default', `${getConfig().urls.portalsUrl.replace(/\/+$/, '')}/p/${d.portal.slug}`);
  }

  // Shared namespaces (cloud tenant, etc.) stay ahead of the dedicated portal hostname so the
  // primary URL prefers the family hostname; compartment priority still applies within each group.
  let namespaces = [...d.namespaces].sort((a, b) => {
    let aSingle = a.namespace.purposes.includes('metorial_portal_single') ? 1 : 0;
    let bSingle = b.namespace.purposes.includes('metorial_portal_single') ? 1 : 0;
    return aSingle - bSingle;
  });

  for (let { namespace } of namespaces) {
    let origin = `https://${namespace.value}.${namespace.compartment.value}`;

    add(
      'namespace',
      namespace.purposes.includes('metorial_portal_single')
        ? origin
        : `${origin}/p/${d.portal.slug}`
    );
  }

  if (!urls.length) add('default', getPortalHost({ portal: d.portal }).host);

  return urls;
};

export let getPrimaryPortalUrls = async (d: { portals: Pick<Portal, 'oid' | 'slug'>[] }) => {
  let namespacesByPortalOid = await namespaceService.getNamespacePropertiesByPortalOid({
    portals: d.portals
  });

  return new Map(
    d.portals.map(portal => {
      let [primary] = getPortalUrls({
        portal,
        namespaces: namespacesByPortalOid.get(portal.oid) ?? []
      });

      return [portal.oid, primary?.url ?? getPortalHost({ portal }).host] as const;
    })
  );
};

export let getPrimaryPortalUrl = async (d: { portal: Pick<Portal, 'oid' | 'slug'> }) => {
  let urls = await getPrimaryPortalUrls({ portals: [d.portal] });

  return urls.get(d.portal.oid) ?? getPortalHost({ portal: d.portal }).host;
};

export let getPortalUrlForOrigin = async (d: {
  portal: Pick<Portal, 'oid' | 'slug'>;
  origin?: string | null;
}) => {
  let namespacesByPortalOid = await namespaceService.getNamespacePropertiesByPortalOid({
    portals: [d.portal]
  });
  let urls = getPortalUrls({
    portal: d.portal,
    namespaces: namespacesByPortalOid.get(d.portal.oid) ?? []
  });

  let requestOrigin = toOrigin(d.origin);
  let match = requestOrigin
    ? urls.find(({ url }) => toOrigin(url) == requestOrigin)
    : undefined;

  return match?.url ?? urls[0]?.url ?? getPortalHost({ portal: d.portal }).host;
};

export let parsePortalIdFromHost = (d: { url: string }) => {
  return parsePortalIdFromTemplate({
    template: env.portal.PORTAL_HOST_TEMPLATE,
    url: d.url
  });
};
