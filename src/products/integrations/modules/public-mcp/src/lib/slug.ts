import { badRequestError, ServiceError } from '@lowerdeck/error';

let slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

// These would collide with edge routes on the shared public MCP host.
let reservedSlugs = new Set([
  '.well-known',
  'well-known',
  'oauth',
  'connect',
  'public',
  'api',
  'mcp',
  'sse',
  'admin',
  'dashboard',
  'health',
  'status',
  'static',
  'assets',
  'favicon.ico',
  'robots.txt',
  'metorial',
  'discovery'
]);

export let normalizePublicMcpSlug = (slug: string) => slug.trim().toLowerCase();

export let assertValidPublicMcpSlug = (slug: string) => {
  if (!slugPattern.test(slug) || slug.includes('--')) {
    throw new ServiceError(
      badRequestError({
        message:
          'Slugs must be 3 to 48 characters long and contain only lowercase letters, numbers, and single dashes.',
        code: 'invalid_public_mcp_slug'
      })
    );
  }

  if (reservedSlugs.has(slug)) {
    throw new ServiceError(
      badRequestError({
        message: 'This slug is reserved.',
        code: 'invalid_public_mcp_slug'
      })
    );
  }
};
