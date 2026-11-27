import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  snowflake,
  withTransaction,
  type ProtoGuardAlertInstance,
  type ProtoGuardFilter,
  type ProtoGuardIssueType,
  type ProtoGuardSeverity,
  type ProviderIssue,
  type ProviderIssueSeverity,
  type ProviderIssueType
} from '@metorial-subspace/db';
import { recordProtoGuardWarningUsage } from '@metorial/module-usage';
import { endOfDay, startOfDay } from 'date-fns';

// Tool-definition families flag a provider's tool schemas, not its traffic. The tool scan plane
// owns them, so they never become provider issues even if one reaches a message alert.
let excludedProtoGuardIssueTypes = new Set<ProtoGuardIssueType>([
  'tool_poisoning',
  'tool_shadowing',
  'tool_rug_pull'
]);

let protoGuardSeverityRank: ProtoGuardSeverity[] = ['critical', 'high', 'medium', 'low'];

let protoGuardIssueSeverity: Record<ProtoGuardSeverity, ProviderIssueSeverity> = {
  critical: 'critical',
  high: 'error',
  medium: 'warning',
  low: 'warning'
};

type IssueOwner = {
  tenantOid: bigint;
  environmentOid: bigint;
  projectOid: bigint | null;
  instanceOid: bigint | null;
};

class ProviderIssueRecorderServiceImpl {
  async recordSessionError(d: { sessionErrorId: string }) {
    let error = await db.sessionError.findUnique({
      where: { id: d.sessionErrorId },
      include: { session: true, providerRun: true }
    });
    if (!error || error.issueOid || error.session.isInternal) return null;

    let providerOid = error.providerRun?.providerOid ?? null;
    let issue = await this.upsertIssue({
      type: 'provider_error',
      subtype: error.type,
      severity: 'error',
      code: error.code,
      message: error.message,
      hashParts: [error.type, String(providerOid), error.code, error.message],
      providerOid,
      owner: error,
      occurredAt: error.createdAt
    });

    return await withTransaction(async db => {
      let claimed = await db.sessionError.updateMany({
        where: { oid: error.oid, issueOid: null },
        data: { issueOid: issue.oid }
      });
      if (!claimed.count) return issue;

      return await this.addOccurrences({ issue, count: 1, occurredAt: error.createdAt });
    });
  }

  async recordAuthConfigError(d: { authConfigErrorId: string }) {
    let error = await db.providerAuthConfigError.findUnique({
      where: { id: d.authConfigErrorId }
    });
    if (!error || error.issueOid) return null;

    let issue = await this.upsertIssue({
      type: 'auth_error',
      subtype: error.type,
      severity: 'error',
      code: error.code,
      message: error.message,
      hashParts: [error.type, String(error.providerOid), error.code, error.message],
      providerOid: error.providerOid,
      owner: error,
      occurredAt: error.createdAt
    });

    return await withTransaction(async db => {
      let claimed = await db.providerAuthConfigError.updateMany({
        where: { oid: error.oid, issueOid: null },
        data: { issueOid: issue.oid }
      });
      if (!claimed.count) return issue;

      return await this.addOccurrences({ issue, count: 1, occurredAt: error.createdAt });
    });
  }

  // `isRepeat` marks a run that was deduplicated into an existing alert: the alert stays the
  // same, but the issue still gains one occurrence.
  async recordProtoGuardAlert(d: { protoGuardAlertId: string; isRepeat?: boolean }) {
    let alert = await db.protoGuardAlert.findUnique({
      where: { id: d.protoGuardAlertId },
      include: {
        providerRun: true,
        message: { include: { sessionProvider: true } },
        instances: {
          where: { stage: 'active', isSuppressed: false },
          include: { filter: true }
        }
      }
    });
    if (!alert) return null;

    let occurredAt = alert.lastSeenAt ?? alert.createdAt;

    if (alert.issueOid) {
      if (!d.isRepeat) return null;

      let issue = await db.providerIssue.findUniqueOrThrow({ where: { oid: alert.issueOid } });
      let updated = await this.addOccurrences({ issue, count: 1, occurredAt });

      await recordProtoGuardWarningUsage({ ...updated, occurredAt, count: 1 });

      return updated;
    }

    let top = this.pickTopProtoGuardInstance(alert.instances);
    if (!top) return null;

    let providerOid =
      alert.providerRun?.providerOid ?? alert.message.sessionProvider?.providerOid ?? null;
    let issue = await this.upsertIssue({
      type: 'protoguard_warning',
      subtype: top.filter.key,
      severity: protoGuardIssueSeverity[top.severity],
      code: top.issueType,
      message: top.filter.name,
      hashParts: [top.filter.key, String(providerOid), top.direction ?? 'unknown'],
      providerOid,
      protoGuardFilterOid: top.filterOid,
      owner: alert,
      occurredAt
    });

    // Claiming a deduplicated alert for the first time brings its earlier repeats along, so the
    // backfill and live path agree on the count.
    let updated = await withTransaction(async db => {
      let claimed = await db.protoGuardAlert.updateMany({
        where: { oid: alert.oid, issueOid: null },
        data: { issueOid: issue.oid }
      });
      if (!claimed.count) return null;

      return await this.addOccurrences({
        issue,
        count: alert.occurrenceCount,
        occurredAt,
        firstSeenAt: alert.firstSeenAt ?? alert.createdAt
      });
    });
    if (!updated) return issue;

    await recordProtoGuardWarningUsage({
      ...updated,
      occurredAt,
      count: alert.occurrenceCount
    });

    return updated;
  }

  private pickTopProtoGuardInstance(
    instances: (ProtoGuardAlertInstance & { filter: ProtoGuardFilter })[]
  ) {
    let candidates = instances.filter(
      instance => !excludedProtoGuardIssueTypes.has(instance.issueType)
    );

    return candidates.sort(
      (a, b) =>
        protoGuardSeverityRank.indexOf(a.severity) -
          protoGuardSeverityRank.indexOf(b.severity) || b.confidence - a.confidence
    )[0];
  }

  private async upsertIssue(d: {
    type: ProviderIssueType;
    subtype: string;
    severity: ProviderIssueSeverity;
    code: string;
    message: string;
    hashParts: string[];
    providerOid: bigint | null;
    protoGuardFilterOid?: bigint;
    owner: IssueOwner;
    occurredAt: Date;
  }) {
    let hash = await Hash.sha256(canonicalize(d.hashParts));
    let where = {
      tenantOid_environmentOid_type_hash: {
        tenantOid: d.owner.tenantOid,
        environmentOid: d.owner.environmentOid,
        type: d.type,
        hash
      }
    };

    let existing = await db.providerIssue.findUnique({ where });
    if (existing) return existing;

    return await db.providerIssue.upsert({
      where,
      create: {
        ...getId('providerIssue'),
        type: d.type,
        subtype: d.subtype,
        severity: d.severity,
        hash,

        code: d.code,
        message: d.message,

        firstSeenAt: d.occurredAt,
        lastSeenAt: d.occurredAt,

        providerOid: d.providerOid,
        protoGuardFilterOid: d.protoGuardFilterOid,
        tenantOid: d.owner.tenantOid,
        environmentOid: d.owner.environmentOid,
        projectOid: d.owner.projectOid!,
        instanceOid: d.owner.instanceOid!
      },
      update: {}
    });
  }

  private async addOccurrences(d: {
    issue: ProviderIssue;
    count: number;
    occurredAt: Date;
    firstSeenAt?: Date;
  }) {
    let dayStart = startOfDay(d.occurredAt);
    let firstSeenAt = d.firstSeenAt ?? d.occurredAt;

    return await withTransaction(async db => {
      await db.providerIssueOccurrencePeriod.upsert({
        where: { issueOid_startsAt: { issueOid: d.issue.oid, startsAt: dayStart } },
        create: {
          oid: snowflake.nextId(),
          issueOid: d.issue.oid,
          startsAt: dayStart,
          endsAt: endOfDay(dayStart),
          occurrenceCount: d.count
        },
        update: { occurrenceCount: { increment: d.count } }
      });

      await db.$executeRaw`
        UPDATE "ProviderIssue"
        SET "occurrenceCount" = "occurrenceCount" + ${d.count},
            "lastSeenAt" = GREATEST("lastSeenAt", ${d.occurredAt}::timestamp),
            "firstSeenAt" = LEAST("firstSeenAt", ${firstSeenAt}::timestamp)
        WHERE "oid" = ${d.issue.oid}
      `;

      return await db.providerIssue.findUniqueOrThrow({ where: { oid: d.issue.oid } });
    });
  }
}

export let providerIssueRecorderService = Service.create(
  'providerIssueRecorderService',
  () => new ProviderIssueRecorderServiceImpl()
).build();
