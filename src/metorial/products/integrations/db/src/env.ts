import { defineSettings } from '@metorial/settings';
import { metorialRegion } from '@metorial/shared-settings';
import { v } from '@lowerdeck/validation';

export let env = defineSettings({
  service: {
    DATABASE_URL: v.string(),

    INTEGRATIONS_API_URL: v.string(),

    // Public host of the global tool-attachment-router Cloudflare Worker. When
    // set, minted tool-call attachment links point at this host instead of
    // INTEGRATIONS_API_URL directly.
    TOOL_CALL_ROUTER_URL: v.optional(v.string()),

    // Region this cell runs in (e.g. "us1"/"eu1"). Encoded as a suffix on
    // minted urlKeys so the router can pick the right regional host, mirroring
    // the file-router's download-key region suffix.
    METORIAL_REGION: metorialRegion
  },
  secrets: {
    SLATE_ATTACHMENT_SIGNING_SECRET: v.string()
  }
});
