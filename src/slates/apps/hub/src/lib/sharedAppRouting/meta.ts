import type { SharedAppVendorAdapter } from './index';

/**
 * Meta signs deliveries, but the current shared protocol registry does not declare a Meta
 * preset and Meta's generic `entry[].id` is not an installation identity. Keep the family
 * explicit and unavailable instead of silently treating a page/object ID as tenant authority.
 */
export let metaSharedAppAdapter: SharedAppVendorAdapter = {
  family: 'meta',
  preset: null,
  securityHeaders: ['x-hub-signature-256'],
  extractAuthenticatedIdentity: () => null
};
