import type { ContentMode, ContentPolicy, ContentRole } from '@mtsrc/agent-tracking-spec';

let explicitOnlyRoles: ContentRole[] = [
  'system_prompt',
  'raw_request',
  'raw_response',
  'path'
];

export let resolveContentMode = (policy: ContentPolicy, role: ContentRole): ContentMode => {
  let override = policy.roles?.[role];
  if (override) return override;

  if (policy.defaultMode == 'full' && explicitOnlyRoles.includes(role)) return 'shape';

  return policy.defaultMode;
};
