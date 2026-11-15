import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';

export type IngestCall = {
  principal: IngestPrincipal;
  requestId: string;
  clientIp?: string;
};
