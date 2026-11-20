import { dialectErrorBody, type Dialect, type GatewayError } from '@mtsrc/ai-gateway-dialects';

export { toGatewayError } from '@mtsrc/ai-gateway-module-inference';
export type { Dialect, GatewayError };

export let errorResponse = (
  dialect: Dialect,
  error: GatewayError,
  headers: Record<string, string> = {}
) =>
  Response.json(dialectErrorBody(dialect, error), {
    status: error.status,
    headers: error.status == 401 ? { 'WWW-Authenticate': 'Bearer', ...headers } : headers
  });
