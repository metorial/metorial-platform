import { isServiceError } from '@lowerdeck/error';
import { assertIngestAllowed, type IngestPrincipal } from '../auth/principal';
import { verifyIngestCredential } from '../auth/verify';
import { normalizeClient } from '../records/clients';
import { invalidClientError, methodNotAllowedError, routeNotFoundError } from './errors';
import { parseIngestRequest } from './parse';
import { caughtErrorResponse, errorResponse, jsonResponse } from './response';
import { matchRoute } from './router';

let authenticateHeaders = { 'WWW-Authenticate': 'Bearer realm="groundstation"' };

export type Authenticate = (credential: string | undefined) => Promise<IngestPrincipal>;

type SocketInfo = { requestIP: (request: Request) => { address: string } | null };

export let createIngestFetch =
  (authenticate: Authenticate) =>
  async (request: Request, server?: SocketInfo): Promise<Response> => {
    try {
      let match = matchRoute(request.method, new URL(request.url).pathname);

      if (match.type == 'not_found') return errorResponse(routeNotFoundError());

      if (match.type == 'method_not_allowed') {
        return errorResponse(methodNotAllowedError(), { Allow: match.allow.join(', ') });
      }

      let definition = match.definition;

      let ingestRequest = parseIngestRequest(request, definition, match.params);
      if (ingestRequest instanceof Response) return ingestRequest;

      if (definition.auth == 'none') return await definition.handler(ingestRequest);

      let principal;

      try {
        principal = await authenticate(ingestRequest.credential);
      } catch (error) {
        if (isServiceError(error) && error.data.status == 401) {
          return jsonResponse(401, error.toResponse(), authenticateHeaders);
        }

        throw error;
      }

      if (ingestRequest.client !== undefined && !normalizeClient(ingestRequest.client)) {
        return errorResponse(invalidClientError());
      }

      let denied = assertIngestAllowed(principal, {
        client: ingestRequest.client,
        channel: definition.channel
      });
      if (denied) return errorResponse(denied);

      return await definition.handler({
        ...ingestRequest,
        principal,
        remoteAddress: server?.requestIP(request)?.address
      });
    } catch (error) {
      return caughtErrorResponse(error);
    }
  };

export let ingestFetch = createIngestFetch(verifyIngestCredential);
