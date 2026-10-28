import { db } from '@metorial-subspace/db';
import { getSubspaceSystemAuditScope } from '@metorial-subspace/module-tenant';
import { Fabric, type AuditSubspaceProtoGuardAlert } from '@metorial/fabric';
import { getFamilyDefinition, getRuleDefinition } from '../definitions/rulesets';
import type { ScoreResult } from '../lib/engine';

export interface AuditableFinding {
  ruleKey: string;
  family: string;
  confidence: number;
  confidenceThreshold: number;
  redactedPath: string;
  startOffset: number;
  endOffset: number;
}

// Audit events outlive message retention, so they carry rule identity and redacted paths only.
// Descriptions come from the ruleset, never from the match.
export let recordProtoGuardAlertAuditEvent = async (d: {
  alertId: string;
  runId: string;
  messageId: string;
  instanceOid: bigint | null;
  projectOid: bigint | null;
  alertFilterCountThreshold: number;
  score: ScoreResult;
  findings: AuditableFinding[];
  createdAt: Date;
}) => {
  try {
    let auditScope = await getSubspaceSystemAuditScope({
      job: 'subspace/protoguard/persistMessageScan',
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
      issueTypes: d.score.familyScores.map(family => family.family),
      score: d.score.score,
      maxScore: d.score.maxScore,
      confidence: d.score.probability,
      triggeredFilterCount: d.score.triggeredFamilyCount,
      matchedInstanceCount: d.findings.length,
      alertFilterCountThreshold: d.alertFilterCountThreshold,
      alertByConfidence:
        d.score.alertReasons.includes('probability') ||
        d.score.alertReasons.includes('hard_rule'),
      alertByFilterCount: d.score.alertReasons.includes('family_count'),
      matches: d.findings.map(finding => {
        let family = getFamilyDefinition(finding.family);

        return {
          filter: { key: finding.family, name: family?.name ?? finding.family },
          issueType: family?.issueType ?? finding.family,
          severity: family?.severity ?? 'medium',
          confidence: finding.confidence,
          confidenceThreshold: finding.confidenceThreshold,
          scoreWeight: family?.scoreWeight ?? 0,
          path: finding.redactedPath,
          startOffset: finding.startOffset,
          endOffset: finding.endOffset,
          description: getRuleDefinition(finding.ruleKey)?.description ?? null
        };
      }),
      createdAt: d.createdAt
    };

    await Fabric.fire('protoguard.alert.created:after', { auditScope, alert });
  } catch (error) {
    console.error('[Audit] Failed to record ProtoGuard alert audit event', error);
  }
};
