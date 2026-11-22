import type { AuthInfo } from '@metorial/module-access';

export let isPublicCatalogOnly = (ctx: {
  auth: AuthInfo;
  accessTags?: unknown;
  consumerSurface?: unknown;
}) =>
  ctx.auth.type == 'machine' &&
  ctx.auth.machineAccess.type == 'instance_publishable' &&
  (!ctx.accessTags || !ctx.consumerSurface);
