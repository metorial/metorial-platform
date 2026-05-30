import { db, getId, withTransaction } from '@metorial-subspace/db';
import { alertInternalService } from '@metorial-subspace/module-monitor';
import { evaluateProtoGuardMessage } from './evaluateProtoguard';

let truncate = (value: string, maxLength: number) =>
  value.length > maxLength ? value.slice(0, maxLength) : value;

let serializeError = (error: unknown) => ({
  message: error instanceof Error ? error.message : 'Unknown ProtoGuard error',
  name: error instanceof Error ? error.name : 'Error'
});

export let createProtoGuardRunForMessage = async (d: { messageId: string }) => {
  let message = await db.sessionMessage.findUnique({
    where: { id: d.messageId }
  });
  if (!message) return null;
  if (message.status === 'waiting_for_response') return null;

  let existingRun = await db.protoGuardRun.findUnique({
    where: { messageOid: message.oid },
    include: { alert: { include: { instances: true } } }
  });
  if (existingRun) return existingRun;

  try {
    let evaluation = await evaluateProtoGuardMessage(message);
    let score = evaluation.score;
    let bestMatch = [...score.matches].sort((a, b) => b.confidence - a.confidence)[0];

    let run = await withTransaction(async db => {
      let run = await db.protoGuardRun.create({
        data: {
          ...getId('protoGuardRun'),
          status: 'completed',
          score: score.score,
          maxScore: score.maxScore,
          confidence: score.confidence,
          triggeredFilterCount: score.triggeredFilterCount,
          matchedInstanceCount: score.matchedInstanceCount,
          alertFilterCountThreshold: evaluation.alertFilterCountThreshold,
          messageOid: message.oid,
          sessionOid: message.sessionOid,
          connectionOid: message.connectionOid,
          providerRunOid: message.providerRunOid,
          tenantOid: message.tenantOid,
          environmentOid: message.environmentOid,
          solutionOid: message.solutionOid
        }
      });

      if (!score.shouldAlert || !bestMatch) {
        return { ...run, alert: null };
      }

      let alert = await db.protoGuardAlert.create({
        data: {
          ...getId('protoGuardAlert'),
          sampleMarkdown: truncate(bestMatch.sampleMarkdown, 8000),
          issueTypes: score.issueTypes,
          runOid: run.oid,
          messageOid: message.oid,
          sessionOid: message.sessionOid,
          connectionOid: message.connectionOid,
          providerRunOid: message.providerRunOid,
          tenantOid: message.tenantOid,
          environmentOid: message.environmentOid,
          solutionOid: message.solutionOid
        }
      });

      await db.protoGuardAlertInstance.createMany({
        data: score.matches.map(match => ({
          ...getId('protoGuardAlertInstance'),
          issueType: match.issueType,
          severity: match.severity,
          path: match.path,
          startOffset: match.startOffset,
          endOffset: match.endOffset,
          matchedText: truncate(match.matchedText, 2000),
          sampleMarkdown: truncate(match.sampleMarkdown, 8000),
          description: match.description,
          confidence: match.confidence,
          confidenceThreshold: match.alertConfidenceThreshold,
          metadata: {
            ...match.metadata,
            filterKey: match.filterKey,
            filterName: match.filterName,
            scoreWeight: match.scoreWeight,
            alertByConfidence: score.alertByConfidence,
            alertByFilterCount: score.alertByFilterCount
          },
          alertOid: alert.oid,
          filterOid: match.filterOid
        }))
      });

      return await db.protoGuardRun.findUniqueOrThrow({
        where: { oid: run.oid },
        include: { alert: { include: { instances: true } } }
      });
    });

    if (run.alert) {
      await alertInternalService.createFromProtoGuardAlert({
        protoGuardAlertId: run.alert.id
      });
    }

    return run;
  } catch (error) {
    let failedExistingRun = await db.protoGuardRun.findUnique({
      where: { messageOid: message.oid },
      include: { alert: { include: { instances: true } } }
    });
    if (failedExistingRun) return failedExistingRun;

    return await db.protoGuardRun.create({
      data: {
        ...getId('protoGuardRun'),
        status: 'failed',
        score: 0,
        maxScore: 0,
        confidence: 0,
        triggeredFilterCount: 0,
        matchedInstanceCount: 0,
        alertFilterCountThreshold: 0,
        error: serializeError(error),
        messageOid: message.oid,
        sessionOid: message.sessionOid,
        connectionOid: message.connectionOid,
        providerRunOid: message.providerRunOid,
        tenantOid: message.tenantOid,
        environmentOid: message.environmentOid,
        solutionOid: message.solutionOid
      }
    });
  }
};
