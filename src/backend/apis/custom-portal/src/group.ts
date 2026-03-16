import { Group } from '@metorial/rpc';
import {
  assertPortalRequestMatchesPortal,
  resolvePortalFromIdOrReferer,
  resolvePortalFromUrl
} from './lib/portal';

export let publicApp = new Group().use(async ctx => {
  return {
    context: {
      ip: ctx.ip ?? '0.0.0.0',
      ua: ctx.headers.get('user-agent') ?? undefined
    }
  };
});

let bindPortalRequest = async (d: {
  headers: Headers;
  portalId?: string;
  portalUrl?: string;
  referer?: string | null;
}) => {
  let resolved = d.portalUrl
    ? await resolvePortalFromUrl({
        url: d.portalUrl
      })
    : await resolvePortalFromIdOrReferer({
        portalId: d.portalId,
        referer: d.referer
      });

  await assertPortalRequestMatchesPortal({
    headers: d.headers,
    portal: resolved.portal,
    portalUrl: resolved.portalUrl
  });

  return resolved;
};

export let portalFromUrlApp = publicApp.use(async ctx => {
  return await bindPortalRequest({
    headers: ctx.headers,
    portalUrl: ctx.body.portalUrl
  });
});

export let portalFromIdApp = publicApp.use(async ctx => {
  return await bindPortalRequest({
    headers: ctx.headers,
    portalId: ctx.body.portalId
  });
});

export let portalFromIdOrRefererApp = publicApp.use(async ctx => {
  return await bindPortalRequest({
    headers: ctx.headers,
    portalId: ctx.body.portalId,
    referer: ctx.headers.get('referer')
  });
});
