import { env } from '../env';

let MAX_PLATFORM_ROUTES = 8;

// Mirrors the egress package's route name rule; anything else would make the gateway refuse the
// whole grant and fail the invocation's every outbound connection.
let platformRouteName = /^[a-z][a-z0-9-]{0,62}$/;

export let grantablePlatformRoutes = (requested: string[] | undefined) => {
  if (!requested?.length) return undefined;

  let grantable = new Set(env.egressGateway.GRANTABLE_PLATFORM_ROUTES);
  let routes = [...new Set(requested)].filter(
    route => grantable.has(route) && platformRouteName.test(route)
  );

  return routes.length ? routes.slice(0, MAX_PLATFORM_ROUTES) : undefined;
};
