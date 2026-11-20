import { toMicroUsd, type BillingWindowWithProject } from '@mtsrc/ai-gateway-module-billing';

export let billingWindowPresenter = (window: BillingWindowWithProject) => ({
  object: 'ai_gateway#billing_window',

  id: window.id,

  projectId: window.project.id,
  projectRef: window.project.ref,
  organizationRef: window.project.organization.ref,

  windowStart: window.windowStart,
  windowEnd: window.windowEnd,
  status: window.status,

  costMicroUsd: toMicroUsd(window.costNanoUsd),
  requestCount: window.requestCount,
  revision: window.revision
});
