import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let aiToolPolicyPayload = (
  aiToolPolicy: FabricEvents['ai_tool.policy.updated:after']['aiToolPolicy']
) => ({
  id: aiToolPolicy.id,
  toolKey: aiToolPolicy.toolKey,
  status: aiToolPolicy.status,
  note: aiToolPolicy.note,
  decidedAt: aiToolPolicy.decidedAt
});

export let recordAiToolPolicyUpdated = async (
  event: FabricEvents['ai_tool.policy.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    if (!event.previousAiToolPolicy) {
      await auditTrackerService.recordEvent(event.auditScope, 'ai_tool_policy', 'create', {
        payload: aiToolPolicyPayload(event.aiToolPolicy),
        recordedAt
      });
      return;
    }

    await auditTrackerService.recordEvent(event.auditScope, 'ai_tool_policy', 'update', {
      payload: aiToolPolicyPayload(event.aiToolPolicy),
      previousPayload: aiToolPolicyPayload(event.previousAiToolPolicy),
      recordedAt
    });
  });
};

Fabric.listen('ai_tool.policy.updated:after', recordAiToolPolicyUpdated);
