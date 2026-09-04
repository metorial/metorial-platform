import { db } from '@metorial-subspace/db';
import { getSubspaceSystemAuditScope } from '@metorial-subspace/module-tenant/src/lib/systemAuditScope';
import { Fabric, type AuditSubspaceProtoGuardAlert } from '@metorial/fabric';
import type { ProtoGuardScoreResult } from './types';

export let recordProtoGuardAlertAuditEvent = async (d: {
  messageId: string;
  instanceOid: bigint | null;
  projectOid: bigint | null;
  alertId: string;
  runId: string;
  alertFilterCountThreshold: number;
  score: ProtoGuardScoreResult;
  createdAt: Date;
}) => {
  try {
    let auditScope = await getSubspaceSystemAuditScope({
      job: 'subspace/protoguard/evaluateMessage',
      instanceOid: d.instanceOid,
      projectOid: d.projectOid,
      metadata: {
        protoGuardAlertId: d.alertId,
        protoGuardRunId: d.runId,
        messageId: d.messageId
      }
    });
    if (!auditScope) return;

    let links = await db.protoGuardAlert.findUnique({
      where: { id: d.alertId },
      select: {
        session: { select: { id: true } },
        connection: { select: { id: true } },
        providerRun: { select: { id: true } }
      }
    });
    if (!links) return;

    let alert: AuditSubspaceProtoGuardAlert = {
      id: d.alertId,
      runId: d.runId,
      messageId: d.messageId,
      sessionId: links.session.id,
      connectionId: links.connection?.id ?? null,
      providerRunId: links.providerRun?.id ?? null,
      issueTypes: d.score.issueTypes,
      score: d.score.score,
      maxScore: d.score.maxScore,
      confidence: d.score.confidence,
      triggeredFilterCount: d.score.triggeredFilterCount,
      matchedInstanceCount: d.score.matchedInstanceCount,
      alertFilterCountThreshold: d.alertFilterCountThreshold,
      alertByConfidence: d.score.alertByConfidence,
      alertByFilterCount: d.score.alertByFilterCount,
      matches: d.score.matches.map(match => ({
        filter: { key: match.filterKey, name: match.filterName },
        issueType: match.issueType,
        severity: match.severity,
        confidence: match.confidence,
        confidenceThreshold: match.alertConfidenceThreshold,
        scoreWeight: match.scoreWeight,
        path: match.path,
        startOffset: match.startOffset,
        endOffset: match.endOffset,
        description: match.description ?? null
      })),
      createdAt: d.createdAt
    };

    await Fabric.fire('protoguard.alert.created:after', { auditScope, alert });
  } catch (error) {
    console.error('[Audit] Failed to record ProtoGuard alert audit event', error);
  }
};
