import { ingestRoutes, type IngestRouteDefinition } from './routes';

export type RouteMatch =
  | { type: 'match'; definition: IngestRouteDefinition; params: Record<string, string> }
  | { type: 'method_not_allowed'; allow: string[] }
  | { type: 'not_found' };

type ParamRoute = {
  definition: IngestRouteDefinition;
  segments: string[];
};

type CompiledRoutes = {
  static: Map<string, Map<string, IngestRouteDefinition>>;
  param: ParamRoute[];
};

let normalizePath = (path: string) =>
  path.length > 1 && path.endsWith('/') ? path.replace(/\/+$/, '') || '/' : path;

let splitPath = (path: string) => path.split('/').filter(segment => segment.length > 0);

export let compileRoutes = (routes: IngestRouteDefinition[]): CompiledRoutes => {
  let compiled: CompiledRoutes = { static: new Map(), param: [] };

  for (let definition of routes) {
    if (definition.path.includes(':')) {
      compiled.param.push({ definition, segments: splitPath(definition.path) });
      continue;
    }

    let path = normalizePath(definition.path);
    let methods = compiled.static.get(path) ?? new Map();

    methods.set(definition.method, definition);
    compiled.static.set(path, methods);
  }

  return compiled;
};

let matchParamRoute = (
  route: ParamRoute,
  pathSegments: string[]
): Record<string, string> | null => {
  if (route.segments.length != pathSegments.length) return null;

  let params: Record<string, string> = {};

  for (let index = 0; index < route.segments.length; index++) {
    let routeSegment = route.segments[index]!;
    let pathSegment = pathSegments[index]!;

    if (routeSegment.startsWith(':')) {
      try {
        params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
      } catch {
        return null;
      }
    } else if (routeSegment != pathSegment) {
      return null;
    }
  }

  return params;
};

let defaultRoutes = compileRoutes(ingestRoutes);

export let matchRoute = (
  method: string,
  pathname: string,
  compiled: CompiledRoutes = defaultRoutes
): RouteMatch => {
  let staticMethods = compiled.static.get(normalizePath(pathname));

  if (staticMethods) {
    let definition = staticMethods.get(method);
    if (definition) return { type: 'match', definition, params: {} };

    return { type: 'method_not_allowed', allow: [...staticMethods.keys()] };
  }

  if (compiled.param.length == 0) return { type: 'not_found' };

  let pathSegments = splitPath(pathname);
  let allow: string[] = [];

  for (let route of compiled.param) {
    let params = matchParamRoute(route, pathSegments);
    if (!params) continue;

    if (route.definition.method == method) {
      return { type: 'match', definition: route.definition, params };
    }

    allow.push(route.definition.method);
  }

  if (allow.length > 0) return { type: 'method_not_allowed', allow };

  return { type: 'not_found' };
};
