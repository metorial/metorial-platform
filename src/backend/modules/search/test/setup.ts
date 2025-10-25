import { vi } from 'vitest';

// Mock environment variables
process.env.MEILISEARCH_HOST = '';
process.env.MEILISEARCH_API_KEY = '';
process.env.MEILISEARCH_INDEX_PREFIX = '';
process.env.OPENSEARCH_HOST = '';
process.env.OPENSEARCH_USERNAME = '';
process.env.OPENSEARCH_PASSWORD = '';
process.env.OPENSEARCH_INDEX_PREFIX = '';
process.env.OPENSEARCH_PROTOCOL = '';
process.env.OPENSEARCH_AWS_MODE = '';
process.env.ALGOLIA_APP_ID = '';
process.env.ALGOLIA_ADMIN_KEY = '';
process.env.ALGOLIA_INDEX_PREFIX = '';

// Mock console methods to reduce test noise
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn()
};
