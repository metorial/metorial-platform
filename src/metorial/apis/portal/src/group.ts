import { Group } from '@lowerdeck/rpc-server';
import {
  assertPortalRequestMatchesPortal,
  resolvePortalFromId,
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
}) => {
  let resolved = d.portalUrl
    ? await resolvePortalFromUrl({
        url: d.portalUrl
      })
    : await resolvePortalFromId({
        portalId: d.portalId
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
