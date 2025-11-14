import { publicApp } from './public';

export let portalApp = publicApp.use(async ctx => {
  return {
    // TODO: @herber authenticate
  };
});
