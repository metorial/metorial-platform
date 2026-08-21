import type { SharedAppVendorAdapter } from './index';

/** Intercom has no exact Hub preset in the reviewed protocol registry yet. */
export let intercomSharedAppAdapter: SharedAppVendorAdapter = {
  family: 'intercom',
  preset: null,
  securityHeaders: ['x-hub-signature'],
  extractAuthenticatedIdentity: () => null
};
