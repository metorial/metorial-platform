import { v } from '@lowerdeck/validation';
import type { AiToolPolicyStatus } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let aiToolPolicyAuditResource = resource({
  name: 'ai_tool_policy',
  payload: v.typedAny<{
    id: string;
    toolKey: string;
    status: AiToolPolicyStatus;
    note: string | null;
    decidedAt: Date;
  }>('ai_tool_policy'),
  presenter: undefined,
  actions: {
    create: true,
    update: true
  }
});
