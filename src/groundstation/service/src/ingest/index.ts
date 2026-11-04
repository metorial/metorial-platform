import { methodNotAllowedError, routeNotFoundError } from './errors';
import { parseIngestRequest } from './parse';
import { caughtErrorResponse, errorResponse } from './response';
import { matchRoute } from './router';

export let ingestFetch = async (request: Request): Promise<Response> => {
  try {
    let match = matchRoute(request.method, new URL(request.url).pathname);

    if (match.type == 'not_found') return errorResponse(routeNotFoundError());

    if (match.type == 'method_not_allowed') {
      return errorResponse(methodNotAllowedError(), { Allow: match.allow.join(', ') });
    }

    let ingestRequest = parseIngestRequest(request, match.definition, match.params);
    if (ingestRequest instanceof Response) return ingestRequest;

    return await match.definition.handler(ingestRequest);
  } catch (error) {
    return caughtErrorResponse(error);
  }
};
