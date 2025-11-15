import { publicApp } from './public';

export let getSessionCookieName = (d: { consumerSurfaceId: string }) =>
  `metorial_consumer_session_${d.consumerSurfaceId.split('_')[1]}`;

export let portalApp = publicApp.use(async ctx => {
  return {
    // TODO: @herber authenticate
  };
});
