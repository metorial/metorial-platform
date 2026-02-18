import type { Instance } from '@metorial/db';
import { methodNotAllowedError, ServiceError } from '@metorial/error';
import { Context } from 'hono';
import { proxySubspacePost, proxySubspaceSSE } from './subspaceProxy';

export let mcpProxyHandler = async (
  c: Context,
  instance: Instance,
  sessionId: string
) => {
  if (c.req.method == 'DELETE') {
    throw new ServiceError(methodNotAllowedError({}));
  }

  if (c.req.method == 'GET') {
    return proxySubspaceSSE(c, instance, sessionId);
  }

  if (c.req.method == 'POST') {
    let connectionToken = c.req.query('connection_token') ?? null;
    return proxySubspacePost(c, instance, sessionId, connectionToken);
  }

  return c.json(methodNotAllowedError().toResponse(), 405);
};
